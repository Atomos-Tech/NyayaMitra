export type Severity = "high" | "medium" | "low";

export type Analysis = {
  title: string;
  documentType: string;
  jurisdictionNote: string;
  plainSummary: string[];
  parties: { name: string; role: string; plainRole: string }[];
  keyDates: { label: string; value: string; note?: string }[];
  money: { label: string; value: string; note?: string }[];
  clauses: { heading: string; quote: string; plain: string; importance: Severity }[];
  obligations: { who: string; what: string; when?: string }[];
  risks: { title: string; severity: Severity; explanation: string; suggestion?: string }[];
  missing: string[];
  questionsForLawyer: string[];
  nextSteps: string[];
  checklist: { item: string; detail?: string }[];
};

export type Comparison = {
  headline: string;
  recommendation: string;
  differences: {
    topic: string;
    docA: string;
    docB: string;
    favours: string;
    severity: Severity;
    whyItMatters: string;
  }[];
  onlyInA: string[];
  onlyInB: string[];
  watchOuts: string[];
};

export type LegalDoc = {
  id: string;
  title: string;
  text: string;
  source: string;
  createdAt: number;
  analysis?: Analysis;
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const asSeverity = (value: unknown): Severity =>
  value === "high" || value === "medium" || value === "low" ? value : "medium";

import { analyzeIndianDocument, compareIndianDocuments } from "./indian-legal-engine.ts";

/**
 * Attempts to repair and parse potentially malformed JSON returned by AI models.
 * Handles markdown fences, reasoning blocks, trailing commas, comments, smart quotes,
 * and truncated JSON objects/arrays.
 */
export function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty response received from analysis.");
  }

  // 1. Strip reasoning blocks: <think>...</think>
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Extract fenced code block if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    text = fenced[1].trim();
  }

  // 3. Locate the outer-most curly braces
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1) {
    throw new Error("No JSON object found in response");
  }

  let candidate = end > start ? text.slice(start, end + 1) : text.slice(start);

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Proceed to repair
  }

  // Attempt 2: Clean comments and smart quotes
  candidate = candidate
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n\r]*/g, "$1")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  // Attempt 3: Remove trailing commas before } or ]
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Proceed to truncation repair
  }

  // Attempt 4: Repair truncated JSON using stack-based bracket and string closure
  const stack: ("}" | "]")[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  let repaired = candidate;
  if (inString) repaired += '"';
  // Strip trailing commas before closing brackets
  repaired = repaired.replace(/,\s*$/g, "");
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  try {
    return JSON.parse(repaired) as Record<string, unknown>;
  } catch {
    // Fall through to error
  }

  throw new Error("The AI response could not be parsed as JSON.");
}

export function normaliseAnalysis(
  raw: string,
  fallbackTitle: string,
  fallbackText?: string,
  fallbackGoal?: string,
): Analysis {
  try {
    const data = parseJsonObject(raw);
    return {
      title: asString(data.title, fallbackTitle) || fallbackTitle,
      documentType: asString(data.documentType, "Legal document"),
      jurisdictionNote: asString(data.jurisdictionNote),
      plainSummary: asArray<string>(data.plainSummary)
        .map((item) => asString(item))
        .filter(Boolean),
      parties: asArray<Record<string, unknown>>(data.parties).map((party) => ({
        name: asString(party.name),
        role: asString(party.role),
        plainRole: asString(party.plainRole),
      })),
      keyDates: asArray<Record<string, unknown>>(data.keyDates).map((item) => ({
        label: asString(item.label),
        value: asString(item.value),
        note: asString(item.note),
      })),
      money: asArray<Record<string, unknown>>(data.money).map((item) => ({
        label: asString(item.label),
        value: asString(item.value),
        note: asString(item.note),
      })),
      clauses: asArray<Record<string, unknown>>(data.clauses).map((item) => ({
        heading: asString(item.heading),
        quote: asString(item.quote),
        plain: asString(item.plain),
        importance: asSeverity(item.importance),
      })),
      obligations: asArray<Record<string, unknown>>(data.obligations).map((item) => ({
        who: asString(item.who),
        what: asString(item.what),
        when: asString(item.when),
      })),
      risks: asArray<Record<string, unknown>>(data.risks).map((item) => ({
        title: asString(item.title),
        severity: asSeverity(item.severity),
        explanation: asString(item.explanation),
        suggestion: asString(item.suggestion),
      })),
      missing: asArray<string>(data.missing)
        .map((item) => asString(item))
        .filter(Boolean),
      questionsForLawyer: asArray<string>(data.questionsForLawyer)
        .map((item) => asString(item))
        .filter(Boolean),
      nextSteps: asArray<string>(data.nextSteps)
        .map((item) => asString(item))
        .filter(Boolean),
      checklist: asArray<Record<string, unknown>>(data.checklist).map((item) => ({
        item: asString(item.item),
        detail: asString(item.detail),
      })),
    };
  } catch (err) {
    console.warn("AI JSON parse failed, falling back to Indian legal engine:", err);
    if (fallbackText) {
      return analyzeIndianDocument(fallbackText, fallbackTitle, fallbackGoal || "");
    }
    throw err;
  }
}

export function normaliseComparison(
  raw: string,
  fallbackA?: { title: string; text: string },
  fallbackB?: { title: string; text: string },
  fallbackGoal?: string,
): Comparison {
  try {
    const data = parseJsonObject(raw);
    return {
      headline: asString(data.headline),
      recommendation: asString(data.recommendation),
      differences: asArray<Record<string, unknown>>(data.differences).map((item) => ({
        topic: asString(item.topic),
        docA: asString(item.docA),
        docB: asString(item.docB),
        favours: asString(item.favours, "Neutral"),
        severity: asSeverity(item.severity),
        whyItMatters: asString(item.whyItMatters),
      })),
      onlyInA: asArray<string>(data.onlyInA)
        .map((item) => asString(item))
        .filter(Boolean),
      onlyInB: asArray<string>(data.onlyInB)
        .map((item) => asString(item))
        .filter(Boolean),
      watchOuts: asArray<string>(data.watchOuts)
        .map((item) => asString(item))
        .filter(Boolean),
    };
  } catch (err) {
    console.warn("AI Comparison JSON parse failed, falling back to Indian legal engine:", err);
    if (fallbackA && fallbackB) {
      return compareIndianDocuments(fallbackA, fallbackB, fallbackGoal || "");
    }
    throw err;
  }
}
