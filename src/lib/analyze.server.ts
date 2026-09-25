import { z } from "zod";

import { createResponsesCall, gatewayErrorResponse, getApiKey } from "./ai/responses.server.ts";
import {
  ANALYSIS_JSON_INSTRUCTIONS,
  COMPARE_JSON_INSTRUCTIONS,
  documentContextBlock,
  INDIA_LEGAL_PERSONA,
} from "./ai/prompts.server.ts";
import { analyzeIndianDocument, compareIndianDocuments } from "./indian-legal-engine";

const analyzeSchema = z.object({
  title: z.string().default("Document"),
  text: z.string().min(40),
  goal: z.string().optional().default(""),
});

const compareSchema = z.object({
  a: z.object({ title: z.string(), text: z.string().min(40) }),
  b: z.object({ title: z.string(), text: z.string().min(40) }),
  goal: z.string().optional().default(""),
});

export async function handleAnalyze(request: Request) {
  let title = "Document";
  let text = "";
  let goal = "";

  try {
    const parsed = analyzeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Please provide the document text." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    title = parsed.data.title;
    text = parsed.data.text;
    goal = parsed.data.goal;

    const apiKey = getApiKey(request);
    if (!apiKey) {
      // Use built-in Indian legal engine
      const analysis = analyzeIndianDocument(text, title, goal);
      return new Response(JSON.stringify(analysis), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const prompt = `Read this document carefully and produce a structured plain-language breakdown for an ordinary person in India.

${goal ? `What the reader cares about: ${goal}\n` : ""}
${documentContextBlock([{ title, text }], 70000)}

${ANALYSIS_JSON_INSTRUCTIONS}`;

    const { textResponse } = createResponsesCall(request, { apiKey, reasoningEffort: "low" }, [
      { role: "system", content: INDIA_LEGAL_PERSONA },
      { role: "user", content: prompt },
    ]);
    return await textResponse();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      return new Response(null, { status: 499 });
    console.error("analyze error, falling back to Indian legal engine", error);
    if (text) {
      const fallbackAnalysis = analyzeIndianDocument(text, title, goal);
      return new Response(JSON.stringify(fallbackAnalysis), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return gatewayErrorResponse(error);
  }
}

export async function handleCompare(request: Request) {
  let a: { title: string; text: string } | null = null;
  let b: { title: string; text: string } | null = null;
  let goal = "";

  try {
    const parsed = compareSchema.safeParse(await request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Pick two documents with text in them." }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    a = parsed.data.a;
    b = parsed.data.b;
    goal = parsed.data.goal;

    const apiKey = getApiKey(request);
    if (!apiKey) {
      const comparison = compareIndianDocuments(a, b, goal);
      return new Response(JSON.stringify(comparison), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const prompt = `Compare these two documents for an ordinary person in India who must choose between them or is being asked to accept the second one.

Document A = "${a.title}". Document B = "${b.title}".
${goal ? `What the reader cares about: ${goal}\n` : ""}
${documentContextBlock(
  [
    { title: `A: ${a.title}`, text: a.text },
    { title: `B: ${b.title}`, text: b.text },
  ],
  35000,
)}

${COMPARE_JSON_INSTRUCTIONS}`;

    const { textResponse } = createResponsesCall(request, { apiKey, reasoningEffort: "low" }, [
      { role: "system", content: INDIA_LEGAL_PERSONA },
      { role: "user", content: prompt },
    ]);
    return await textResponse();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      return new Response(null, { status: 499 });
    console.error("compare error, falling back to Indian legal engine", error);
    if (a && b) {
      const fallbackComparison = compareIndianDocuments(a, b, goal);
      return new Response(JSON.stringify(fallbackComparison), {
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    return gatewayErrorResponse(error);
  }
}
