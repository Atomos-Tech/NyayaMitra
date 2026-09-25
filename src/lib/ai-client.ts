import { analyzeIndianDocument, compareIndianDocuments } from "./indian-legal-engine";

/** Calls a streaming text endpoint and returns the full accumulated text. */
export async function streamTextEndpoint(
  url: string,
  body: unknown,
  onChunk?: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = { "content-type": "application/json" };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      let message = "Something went wrong. Please try again.";
      try {
        const data = (await response.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        /* keep default */
      }
      if (response.status === 429) message = "Too many requests right now. Try again in a moment.";
      if (response.status === 402) message = "AI credits are exhausted. Add credits to continue.";
      throw new Error(message);
    }

    if (!response.body) throw new Error("No response received.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      onChunk?.(accumulated);
    }
    accumulated += decoder.decode();
    if (!accumulated.trim()) throw new Error("The AI returned an empty reply. Please try again.");
    return accumulated;
  } catch (error) {
    // If network or server fails, attempt direct client fallback if it's analyze or compare
    const typedBody = body as {
      title?: string;
      text?: string;
      a?: { title: string; text: string };
      b?: { title: string; text: string };
      goal?: string;
    };
    if (url.includes("/api/analyze") && typedBody?.text) {
      const res = analyzeIndianDocument(
        typedBody.text,
        typedBody.title || "Document",
        typedBody.goal || "",
      );
      const resStr = JSON.stringify(res);
      onChunk?.(resStr);
      return resStr;
    }
    if (url.includes("/api/compare") && typedBody?.a && typedBody?.b) {
      const res = compareIndianDocuments(typedBody.a, typedBody.b, typedBody.goal || "");
      const resStr = JSON.stringify(res);
      onChunk?.(resStr);
      return resStr;
    }
    throw error;
  }
}
