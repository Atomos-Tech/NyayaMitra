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

/** Pull the first JSON object out of a model response and normalise it. */
export function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI reply could not be read.");
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

export function normaliseAnalysis(raw: string, fallbackTitle: string): Analysis {
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
}

export function normaliseComparison(raw: string): Comparison {
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
}
