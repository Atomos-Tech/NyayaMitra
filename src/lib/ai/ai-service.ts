import { answerIndianLegalQuery } from "../indian-legal-engine";
import { INDIA_LEGAL_PERSONA, documentContextBlock } from "./prompts.server";

export type ApiKeyType = "gemini" | "openrouter" | "openai" | "none";

export function detectApiKeyType(key?: string | null): ApiKeyType {
  if (!key || !key.trim()) return "none";
  const trimmed = key.trim();
  if (trimmed.startsWith("AIzaSy")) return "gemini";
  if (trimmed.startsWith("sk-or-")) return "openrouter";
  if (trimmed.startsWith("sk-")) return "openai";
  return "none";
}

export const DEFAULT_OPENROUTER_KEY =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_OPENROUTER_API_KEY) ||
  "";

export function getStoredApiKey(): string {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("nyaya_custom_api_key");
    } catch {
      // ignore
    }
  }
  return DEFAULT_OPENROUTER_KEY;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AttachedDoc {
  title: string;
  text: string;
}

export interface StreamChatOptions {
  messages: ChatMessage[];
  documents?: AttachedDoc[];
  apiKey?: string;
  model?: string;
  onChunk?: (delta: string, accumulated: string) => void;
  signal?: AbortSignal;
}

function buildSystemPrompt(documents: AttachedDoc[] = []): string {
  return `${INDIA_LEGAL_PERSONA}

${
  documents.length > 0
    ? `The user has attached ${documents.length} legal document(s). Answer strictly from them, quoting the relevant clauses and lines verbatim. If an answer cannot be determined from the documents, clearly state that, then explain what Indian statutory law (e.g. Indian Contract Act 1872, Model Tenancy Act, s.138 NI Act, Consumer Protection Act) usually prescribes.

${documentContextBlock(documents, 45000)}`
    : `The user has not attached any document. Answer general Indian legal-information questions with relevant statutory citations and practical advice for navigating the issue in India.`
}

Formatting:
- Format in clean, readable GitHub Markdown.
- Lead with a direct, unambiguous answer in 1-2 sentences.
- Use bullet points for clauses, rights, and steps.
- Bold important deadlines, statutory sections, and ₹ financial amounts.
- End with 1-2 concrete next steps or questions to ask an advocate.
- Do NOT provide formal legal representation disclaimer on every single turn; keep it concise and practical.`;
}

/**
 * Stream completion directly from Google Gemini API
 */
async function streamGemini(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onChunk?: (delta: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Build Gemini contents payload
  const contents = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2500,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  if (!res.body) throw new Error("No response body from Gemini.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.replace(/^data:\s*/, "");
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const candidates = parsed?.candidates;
        if (candidates && candidates.length > 0) {
          const parts = candidates[0]?.content?.parts;
          if (parts && parts.length > 0) {
            for (const part of parts) {
              if (part.text) {
                accumulated += part.text;
                onChunk?.(part.text, accumulated);
              }
            }
          }
        }
      } catch {
        // ignore incomplete SSE chunk
      }
    }
  }

  return accumulated.trim();
}

/**
 * Stream completion from OpenRouter API
 */
async function streamOpenRouter(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  customModel?: string,
  onChunk?: (delta: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const model = customModel || "google/gemini-2.5-flash";
  const url = "https://openrouter.ai/api/v1/chat/completions";

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const body = {
    model,
    messages: formattedMessages,
    max_tokens: 3000,
    temperature: 0.2,
    stream: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer":
        typeof window !== "undefined"
          ? window.location.origin
          : "https://nyayamitra-509713.web.app",
      "X-Title": "Nyaya Mitra Legal AI",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }

  if (!res.body) throw new Error("No response body from OpenRouter.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      if (trimmed === "data: [DONE]") break;
      const jsonStr = trimmed.replace(/^data:\s*/, "");
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onChunk?.(delta, accumulated);
        }
      } catch {
        // ignore chunk parse error
      }
    }
  }

  return accumulated.trim();
}

/**
 * Stream completion from OpenAI API
 */
async function streamOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onChunk?: (delta: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const model = "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const body = {
    model,
    messages: formattedMessages,
    max_tokens: 3000,
    temperature: 0.2,
    stream: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  if (!res.body) throw new Error("No response body from OpenAI.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      if (trimmed === "data: [DONE]") break;
      const jsonStr = trimmed.replace(/^data:\s*/, "");
      if (!jsonStr) continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          accumulated += delta;
          onChunk?.(delta, accumulated);
        }
      } catch {
        // ignore
      }
    }
  }

  return accumulated.trim();
}

/**
 * Main unified streaming entry point.
 * Works seamlessly client-side on Firebase Hosting (direct API call) OR via /api/chat SSR,
 * and automatically falls back to the deterministic built-in Indian legal engine.
 */
export async function streamUnifiedLegalChat(opts: StreamChatOptions): Promise<string> {
  const key = opts.apiKey || getStoredApiKey();
  const keyType = detectApiKeyType(key);
  const systemPrompt = buildSystemPrompt(opts.documents || []);

  const lastUserMsg = [...opts.messages].reverse().find((m) => m.role === "user");
  const query = lastUserMsg?.content || "General Indian legal query";

  try {
    if (keyType === "gemini") {
      return await streamGemini(key, systemPrompt, opts.messages, opts.onChunk, opts.signal);
    }

    if (keyType === "openrouter") {
      return await streamOpenRouter(
        key,
        systemPrompt,
        opts.messages,
        opts.model,
        opts.onChunk,
        opts.signal,
      );
    }

    if (keyType === "openai") {
      return await streamOpenAI(key, systemPrompt, opts.messages, opts.onChunk, opts.signal);
    }

    // If running in an environment with /api/chat (e.g. dev server)
    try {
      const serverRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: opts.messages,
          documents: opts.documents || [],
        }),
        signal: opts.signal,
      });

      if (serverRes.ok && serverRes.body) {
        const reader = serverRes.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          opts.onChunk?.(chunk, accumulated);
        }
        accumulated += decoder.decode();
        if (accumulated.trim()) return accumulated.trim();
      }
    } catch {
      // /api/chat not available (e.g. on static Firebase Hosting), fall through
    }

    // Default: Built-in Indian Statutory Rule Engine
    const localAnswer = answerIndianLegalQuery(query, opts.documents || []);
    opts.onChunk?.(localAnswer, localAnswer);
    return localAnswer;
  } catch (error) {
    console.warn("AI streaming unavailable, falling back to built-in Indian legal engine.");
    const localAnswer = answerIndianLegalQuery(query, opts.documents || []);
    opts.onChunk?.(localAnswer, localAnswer);
    return localAnswer;
  }
}
