import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server.ts";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const CHAT_MODEL = "openai/gpt-6-astra";

export function getApiKey(request?: Request): string | null {
  const headerKey =
    request?.headers.get("x-api-key") ||
    request?.headers.get("x-openai-key") ||
    request?.headers.get("x-gemini-key");
  if (headerKey && headerKey.trim()) return headerKey.trim();
  const envGemini = process.env["GEMINI_API_KEY"];
  if (envGemini && envGemini.trim()) return envGemini.trim();
  const envOpenRouter =
    process.env["OPENROUTER_API_KEY"] ||
    process.env["VITE_OPENROUTER_API_KEY"] ||
    ((typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_OPENROUTER_API_KEY) ||
      "");
  if (envOpenRouter && envOpenRouter.trim()) return envOpenRouter.trim();
  const envOpenAi = process.env["OPENAI_API_KEY"];
  if (envOpenAi && envOpenAi.trim()) return envOpenAi.trim();
  const envLovable = process.env["LOVABLE_API_KEY"];
  if (envLovable && envLovable.trim()) return envLovable.trim();
  return null;
}

export function createResponsesCall(
  request: Request,
  config: {
    baseURL?: string;
    apiKey: string;
    model?: string;
    reasoningEffort?: "low" | "medium" | "high";
  },
  messages: ModelMessage[],
) {
  const isGemini = config.apiKey.startsWith("AIzaSy");
  const isOpenRouter = config.apiKey.startsWith("sk-or-");
  const isDirectOpenAi = config.apiKey.startsWith("sk-") && !isOpenRouter;

  let baseURL = config.baseURL;
  let model = config.model;

  if (!baseURL) {
    if (isGemini) {
      baseURL = "https://generativelanguage.googleapis.com/v1beta/openai";
      model = model ?? "gemini-2.5-flash";
    } else if (isOpenRouter) {
      baseURL = "https://openrouter.ai/api/v1";
      model = model ?? "google/gemini-2.5-flash";
    } else if (isDirectOpenAi) {
      baseURL = "https://api.openai.com/v1";
      model = model ?? "gpt-4o-mini";
    } else {
      baseURL = GATEWAY_URL;
      model = model ?? CHAT_MODEL;
    }
  }

  const isExternalStandard = isGemini || isOpenRouter || isDirectOpenAi;
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: isExternalStandard
      ? {
          Authorization: `Bearer ${config.apiKey}`,
          ...(isOpenRouter
            ? {
                "HTTP-Referer": "https://nyayamitra-509713.web.app",
                "X-Title": "Nyaya Mitra Legal AI",
              }
            : {}),
        }
      : { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: isExternalStandard ? fetch : runIdFetch.fetch,
  });

  // Vercel AI SDK disallows { role: 'system' } inside the messages array.
  // Extract system message into the top-level `system` option.
  const systemMsg = messages.find((m) => m.role === "system");
  const system =
    typeof systemMsg?.content === "string"
      ? systemMsg.content
      : Array.isArray(systemMsg?.content)
        ? (systemMsg.content as { text?: string }[]).map((p) => p.text || "").join("\n")
        : undefined;
  const nonSystemMessages = messages.filter((m) => m.role !== "system");
  const finalMessages =
    nonSystemMessages.length > 0
      ? nonSystemMessages
      : [{ role: "user" as const, content: "Please analyze the document." }];

  const result = streamText({
    model: isExternalStandard
      ? provider(model || "gemini-2.5-flash")
      : provider.responses(model || CHAT_MODEL),
    system,
    messages: finalMessages,
    maxOutputTokens: 3000,
    abortSignal: request.signal,
    onError: ({ error }) => {
      console.error("streamText execution error:", error);
    },
    providerOptions: {
      openai: {
        store: false,
      },
    },
  });

  return {
    result,
    uiResponse: (options?: Parameters<typeof result.toUIMessageStreamResponse>[0]) =>
      isExternalStandard
        ? result.toUIMessageStreamResponse({ sendReasoning: true, ...options })
        : withLovableAiGatewayRunIdHeader(
            result.toUIMessageStreamResponse({ sendReasoning: true, ...options }),
            runIdFetch,
          ),
    textResponse: () =>
      isExternalStandard
        ? result.toTextStreamResponse()
        : withLovableAiGatewayRunIdHeader(result.toTextStreamResponse(), runIdFetch),
  };
}

export function gatewayErrorResponse(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "Too many requests right now. Please try again in a moment." }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }
  if (status === 402) {
    return new Response(
      JSON.stringify({ error: "AI credits are exhausted. Add credits to continue." }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ error: message }), {
    status: status && status >= 400 && status < 600 ? status : 500,
    headers: { "content-type": "application/json" },
  });
}
