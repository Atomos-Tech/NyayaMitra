import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell, SeverityPill } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { streamTextEndpoint } from "@/lib/ai-client";
import { normaliseComparison, type Comparison } from "@/lib/legal-types";
import { SAMPLE_DOCUMENTS } from "@/lib/samples";
import { useDocs } from "@/lib/store";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Legal Documents — Nyaya Mitra" },
      {
        name: "description",
        content:
          "Side-by-side comparison of agreements, offer letters, or policies. See what changed and who each clause favours.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const docs = useDocs();

  // Selected or custom docs
  const [docAId, setDocAId] = useState<string>(docs[0]?.id || "sample-0");
  const [docBId, setDocBId] = useState<string>(docs[1]?.id || "sample-1");

  const [customA, setCustomA] = useState({ title: "Document A", text: "" });
  const [customB, setCustomB] = useState({ title: "Document B", text: "" });

  const [goal, setGoal] = useState("");
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  // Resolve document A content
  const getDocA = () => {
    if (docAId.startsWith("sample-")) {
      const idx = parseInt(docAId.replace("sample-", ""), 10);
      const sample = SAMPLE_DOCUMENTS[idx] || SAMPLE_DOCUMENTS[0];
      return { title: sample.title, text: sample.text };
    }
    if (docAId === "custom") return customA;
    const found = docs.find((d) => d.id === docAId);
    return found ? { title: found.title, text: found.text } : customA;
  };

  // Resolve document B content
  const getDocB = () => {
    if (docBId.startsWith("sample-")) {
      const idx = parseInt(docBId.replace("sample-", ""), 10);
      const sample = SAMPLE_DOCUMENTS[idx] || SAMPLE_DOCUMENTS[1] || SAMPLE_DOCUMENTS[0];
      return { title: sample.title, text: sample.text };
    }
    if (docBId === "custom") return customB;
    const found = docs.find((d) => d.id === docBId);
    return found ? { title: found.title, text: found.text } : customB;
  };

  const handleCompare = async () => {
    const a = getDocA();
    const b = getDocB();

    if (!a.text.trim() || a.text.length < 40) {
      toast.error("Document A needs at least a paragraph of text.");
      return;
    }
    if (!b.text.trim() || b.text.length < 40) {
      toast.error("Document B needs at least a paragraph of text.");
      return;
    }

    setComparing(true);
    setComparison(null);

    try {
      const raw = await streamTextEndpoint("/api/compare", { a, b, goal });
      const parsed = normaliseComparison(raw, a, b, goal);
      setComparison(parsed);
      toast.success("Comparison completed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed.");
    } finally {
      setComparing(false);
    }
  };

  const copyReport = () => {
    if (!comparison) return;
    const rep = `NYAYA MITRA COMPARISON REPORT
${comparison.headline}

RECOMMENDATION:
${comparison.recommendation}

KEY DIFFERENCES:
${comparison.differences
  .map(
    (d) =>
      `• ${d.topic} [Favours: ${d.favours}] [Severity: ${d.severity}]
   - Doc A: ${d.docA}
   - Doc B: ${d.docB}
   - Why it matters: ${d.whyItMatters}`,
  )
  .join("\n\n")}

WATCH-OUTS:
${comparison.watchOuts.map((w) => `• ${w}`).join("\n")}`;

    navigator.clipboard.writeText(rep);
    toast.success("Comparison report copied to clipboard!");
  };

  const docA = getDocA();
  const docB = getDocB();

  return (
    <AppShell className="print:p-0">
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          <Scale className="size-3.5" /> Side-by-Side Comparison
        </span>
        <h1 className="mt-3 text-3xl font-bold text-foreground sm:text-4xl">
          Compare two agreements or drafts
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          See what changed between drafts, compare counter-offers, or spot one-sided clauses before
          accepting a renegotiated contract.
        </p>
      </div>

      {/* Selectors Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Document A Selector */}
        <div className="paper p-6">
          <div className="flex items-center justify-between">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
              Document A (Base / Original)
            </span>
            <span className="text-xs text-muted-foreground">{docA.text.length} chars</span>
          </div>

          <label className="mt-4 block text-xs font-semibold text-foreground">Select Source</label>
          <select
            value={docAId}
            onChange={(e) => setDocAId(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
          >
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                📄 {d.title}
              </option>
            ))}
            <optgroup label="Sample Documents">
              {SAMPLE_DOCUMENTS.map((s, idx) => (
                <option key={`sample-${idx}`} value={`sample-${idx}`}>
                  📋 {s.title}
                </option>
              ))}
            </optgroup>
            <option value="custom">✏️ Paste Custom Text…</option>
          </select>

          {docAId === "custom" && (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Title for Document A"
                value={customA.title}
                onChange={(e) => setCustomA({ ...customA, title: e.target.value })}
                className="text-xs"
              />
              <Textarea
                placeholder="Paste Document A text here…"
                rows={6}
                value={customA.text}
                onChange={(e) => setCustomA({ ...customA, text: e.target.value })}
                className="text-xs font-mono"
              />
            </div>
          )}

          <div className="mt-3 max-h-32 overflow-hidden rounded bg-surface/50 p-2.5 text-xs text-muted-foreground">
            <p className="line-clamp-4 font-mono whitespace-pre-wrap">{docA.text.slice(0, 300)}…</p>
          </div>
        </div>

        {/* Document B Selector */}
        <div className="paper p-6">
          <div className="flex items-center justify-between">
            <span className="rounded bg-accent/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
              Document B (Counter / New Version)
            </span>
            <span className="text-xs text-muted-foreground">{docB.text.length} chars</span>
          </div>

          <label className="mt-4 block text-xs font-semibold text-foreground">Select Source</label>
          <select
            value={docBId}
            onChange={(e) => setDocBId(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground"
          >
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                📄 {d.title}
              </option>
            ))}
            <optgroup label="Sample Documents">
              {SAMPLE_DOCUMENTS.map((s, idx) => (
                <option key={`sample-${idx}`} value={`sample-${idx}`}>
                  📋 {s.title}
                </option>
              ))}
            </optgroup>
            <option value="custom">✏️ Paste Custom Text…</option>
          </select>

          {docBId === "custom" && (
            <div className="mt-3 space-y-2">
              <Input
                placeholder="Title for Document B"
                value={customB.title}
                onChange={(e) => setCustomB({ ...customB, title: e.target.value })}
                className="text-xs"
              />
              <Textarea
                placeholder="Paste Document B text here…"
                rows={6}
                value={customB.text}
                onChange={(e) => setCustomB({ ...customB, text: e.target.value })}
                className="text-xs font-mono"
              />
            </div>
          )}

          <div className="mt-3 max-h-32 overflow-hidden rounded bg-surface/50 p-2.5 text-xs text-muted-foreground">
            <p className="line-clamp-4 font-mono whitespace-pre-wrap">{docB.text.slice(0, 300)}…</p>
          </div>
        </div>
      </div>

      {/* Optional Focus Input & Action */}
      <div className="paper mt-6 p-6">
        <label className="block text-xs font-semibold text-foreground" htmlFor="compare-goal">
          Specific concern or role (optional)
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="compare-goal"
            placeholder="e.g. I am the tenant, which draft protects my deposit better? Or: Compare non-compete clauses"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="text-sm"
          />
          <Button
            onClick={handleCompare}
            disabled={comparing}
            className="shrink-0 gap-2 font-semibold"
          >
            {comparing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Comparing…
              </>
            ) : (
              <>
                <Scale className="size-4" />
                Run AI Comparison
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="mt-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Headline & Recommendation */}
          <div className="paper overflow-hidden border-accent/40 p-6 shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                  Comparison Verdict
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold text-foreground">
                  {comparison.headline}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={copyReport} className="gap-1.5">
                  <Copy className="size-3.5" />
                  Copy Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" />
                  Print
                </Button>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 size-5 shrink-0 text-accent" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Safety Recommendation</h3>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                    {comparison.recommendation}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Differences Table / Cards */}
          <div className="paper p-6">
            <h3 className="font-display text-xl font-bold text-foreground">
              Clause-by-Clause Divergences
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Key topics that differ between the two drafts, tagged with who each clause favours.
            </p>

            <div className="mt-6 space-y-4">
              {comparison.differences.map((diff, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base font-bold text-foreground">
                        {diff.topic}
                      </span>
                      <SeverityPill level={diff.severity} />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        diff.favours === "A"
                          ? "bg-primary/15 text-primary"
                          : diff.favours === "B"
                            ? "bg-accent/15 text-accent"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      Favours:{" "}
                      {diff.favours === "A"
                        ? `Doc A (${docA.title.slice(0, 20)})`
                        : diff.favours === "B"
                          ? `Doc B (${docB.title.slice(0, 20)})`
                          : "Neutral"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-surface/60 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Document A Says:
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground">{diff.docA}</p>
                    </div>

                    <div className="rounded-lg bg-surface/60 p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Document B Says:
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground">{diff.docB}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border-l-2 border-accent bg-accent/5 p-3 text-xs text-muted-foreground">
                    <strong className="text-foreground">Why this matters: </strong>
                    {diff.whyItMatters}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unique clauses in A vs B */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="paper p-6">
              <h3 className="font-display text-base font-semibold text-foreground">
                Found ONLY in Document A
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Terms present in the first version that were removed or absent in Document B:
              </p>
              <ul className="mt-4 space-y-2">
                {comparison.onlyInA.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                    <span className="mt-0.5 text-primary">•</span>
                    <span>{item}</span>
                  </li>
                ))}
                {comparison.onlyInA.length === 0 && (
                  <p className="text-xs text-muted-foreground">No exclusive terms in Document A.</p>
                )}
              </ul>
            </div>

            <div className="paper p-6">
              <h3 className="font-display text-base font-semibold text-foreground">
                Found ONLY in Document B
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                New clauses or requirements added to Document B:
              </p>
              <ul className="mt-4 space-y-2">
                {comparison.onlyInB.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                    <span className="mt-0.5 text-accent">•</span>
                    <span>{item}</span>
                  </li>
                ))}
                {comparison.onlyInB.length === 0 && (
                  <p className="text-xs text-muted-foreground">No exclusive terms in Document B.</p>
                )}
              </ul>
            </div>
          </div>

          {/* Watch-Outs Banner */}
          <div className="paper p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <h3 className="font-display text-lg font-bold text-foreground">
                Critical Pre-Signing Watch-Outs
              </h3>
            </div>
            <ul className="mt-4 space-y-2">
              {comparison.watchOuts.map((w, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </AppShell>
  );
}
