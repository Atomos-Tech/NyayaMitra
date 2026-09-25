import { z } from "zod";

import { createResponsesCall, getApiKey } from "./ai/responses.server.ts";
import { documentContextBlock, INDIA_LEGAL_PERSONA } from "./ai/prompts.server.ts";
import { answerIndianLegalQuery } from "./indian-legal-engine";

interface ChatPart {
  type: string;
  text?: string;
}

interface IncomingMessage {
  role?: string;
  content?: string;
  text?: string;
  parts?: ChatPart[];
}

const bodySchema = z.object({
  messages: z.array(z.record(z.unknown())),
  documents: z
    .array(z.object({ title: z.string(), text: z.string() }))
    .max(4)
    .optional()
    .default([]),
});

export async function handleChat(request: Request) {
  let messages: IncomingMessage[] = [];
  let documents: { title: string; text: string }[] = [];

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid chat request." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    messages = parsed.data.messages as unknown as IncomingMessage[];
    documents = parsed.data.documents.filter((doc) => doc.text.trim().length > 0);

    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    let query = "";
    if (typeof lastUserMsg?.content === "string") {
      query = lastUserMsg.content;
    } else if (typeof lastUserMsg?.text === "string") {
      query = lastUserMsg.text;
    } else if (Array.isArray(lastUserMsg?.parts)) {
      query = lastUserMsg.parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ");
    }
    if (!query.trim()) query = "General legal query";

    const apiKey = getApiKey(request);
    if (!apiKey) {
      const reply = answerIndianLegalQuery(query, documents);
      return new Response(reply, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const system = `${INDIA_LEGAL_PERSONA}

${
  documents.length
    ? `The user has attached ${documents.length} document(s). Answer strictly from them, quoting the relevant lines. If the answer is not in the documents, say so, then explain what usually applies in India and what to check.

${documentContextBlock(documents, 45000)}`
    : `The user has not attached any document yet. Answer general Indian legal-information questions, and invite them to add a document from the workspace for a grounded answer.`
}

Formatting: use short markdown. Lead with the direct answer in one or two lines, then supporting detail. Use bullet lists over paragraphs. Bold the key figures, dates and deadlines. End with one line of practical next step when useful. Do not repeat a long disclaimer every time; add a brief reminder only when the question calls for real legal advice.`;

    const modelMessages = [
      { role: "system" as const, content: system },
      ...messages.map((m) => {
        let text = "";
        if (typeof m.content === "string") text = m.content;
        else if (typeof m.text === "string") text = m.text;
        else if (Array.isArray(m.parts)) {
          text = m.parts
            .filter((p) => p.type === "text" && typeof p.text === "string")
            .map((p) => p.text)
            .join(" ");
        }
        return {
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: text || "",
        };
      }),
    ];

    const { textResponse } = createResponsesCall(
      request,
      { apiKey, reasoningEffort: "low" },
      modelMessages,
    );

    return await textResponse();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("chat error, falling back to Indian legal engine", error);
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    let query = "";
    if (typeof lastUserMsg?.content === "string") query = lastUserMsg.content;
    else if (typeof lastUserMsg?.text === "string") query = lastUserMsg.text;
    else if (Array.isArray(lastUserMsg?.parts)) {
      query = lastUserMsg.parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ");
    }
    if (!query.trim()) query = "General legal query";

    const reply = answerIndianLegalQuery(query, documents);
    return new Response(reply, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
