import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  DollarSign,
  Download,
  FileCheck,
  FileQuestion,
  FileText,
  HelpCircle,
  IndianRupee,
  Layers,
  Loader2,
  MessageSquare,
  Pencil,
  RefreshCw,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell, SeverityPill } from "@/components/AppShell";
import { LegalMarkdown } from "@/components/LegalMarkdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { streamTextEndpoint } from "@/lib/ai-client";
import { normaliseAnalysis } from "@/lib/legal-types";
import { deleteDoc, renameDoc, saveAnalysis, useDoc } from "@/lib/store";
import { answerIndianLegalQuery } from "@/lib/indian-legal-engine";
import { streamUnifiedLegalChat } from "@/lib/ai/ai-service";

export const Route = createFileRoute("/doc/$docId")({
  head: () => ({
    meta: [
      { title: "Document Analysis — Nyaya Mitra" },
      {
        name: "description",
        content:
          "Plain-language clause breakdown, red flags, obligations and next steps under Indian law.",
      },
    ],
  }),
  component: DocumentDetail,
});

function DocumentDetail() {
  const { docId } = useParams({ from: "/doc/$docId" });
  const doc = useDoc(docId);
  const navigate = useNavigate();

  const [analyzing, setAnalyzing] = useState(false);
  const [goal, setGoal] = useState("");
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [clauseSearch, setClauseSearch] = useState("");
  const [clauseFilter, setClauseFilter] = useState<string>("all");
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  // Embedded Ask Chat state
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; text: string }[]>(
    [],
  );
  const [chatBusy, setChatBusy] = useState(false);

  // Completed checklist items
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (doc) {
      setNewTitle(doc.title);
    }
  }, [doc]);

  // Run analysis if not yet analyzed
  const runAnalysis = async (customGoal = goal) => {
    if (!doc) return;
    setAnalyzing(true);
    try {
      const raw = await streamTextEndpoint("/api/analyze", {
        title: doc.title,
        text: doc.text,
        goal: customGoal,
      });
      const analysis = normaliseAnalysis(raw, doc.title, doc.text, customGoal);
      saveAnalysis(doc.id, analysis);
      toast.success("Document analyzed successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze document.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Automatically trigger analysis on first load if missing
  useEffect(() => {
    if (doc && !doc.analysis && !analyzing) {
      runAnalysis();
    }
  }, [doc?.id]);

  const handleAsk = async (questionText?: string) => {
    const q = (questionText || chatQuestion).trim();
    if (!q || !doc) return;

    setActiveTab("ask");
    setTimeout(() => {
      document.getElementById("doc-tabs")?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    const newHistory = [...chatHistory, { role: "user" as const, text: q }];
    setChatHistory(newHistory);
    setChatQuestion("");
    setChatBusy(true);

    try {
      const messages = newHistory.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const reply = await streamUnifiedLegalChat({
        messages,
        documents: [{ title: doc.title, text: doc.text }],
        onChunk: (_delta, accumulated) => {
          setChatHistory([...newHistory, { role: "assistant", text: accumulated }]);
        },
      });

      setChatHistory([...newHistory, { role: "assistant", text: reply }]);
    } catch {
      const answer = answerIndianLegalQuery(q, [{ title: doc.title, text: doc.text }]);
      setChatHistory([...newHistory, { role: "assistant", text: answer }]);
    } finally {
      setChatBusy(false);
    }
  };

  if (!doc) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <FileText className="mx-auto size-12 text-muted-foreground opacity-50" />
          <h2 className="mt-4 font-display text-2xl font-bold">Document not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This document may have been removed or does not exist in your browser storage.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Back to Documents</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const analysis = doc.analysis;
  const filteredClauses = (analysis?.clauses || []).filter((clause) => {
    const matchesFilter = clauseFilter === "all" || clause.importance === clauseFilter;
    const matchesSearch =
      !clauseSearch ||
      clause.heading.toLowerCase().includes(clauseSearch.toLowerCase()) ||
      clause.plain.toLowerCase().includes(clauseSearch.toLowerCase()) ||
      clause.quote.toLowerCase().includes(clauseSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const highRisks = (analysis?.risks || []).filter((r) => r.severity === "high");
  const mediumRisks = (analysis?.risks || []).filter((r) => r.severity === "medium");

  const copyToClipboard = (text: string, label = "Text") => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell className="print:p-0">
      {/* Back & Breadcrumb */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="size-4" />
              All Documents
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="max-w-[280px] truncate text-sm font-medium text-foreground sm:max-w-md">
            {doc.title}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveTab("ask");
              setTimeout(() => {
                document.getElementById("doc-tabs")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
            className="gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
          >
            <MessageSquare className="size-3.5" />
            Ask Nyaya Mitra
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAnalysis()}
            disabled={analyzing}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${analyzing ? "animate-spin" : ""}`} />
            {analyzing ? "Analysing…" : "Re-analyse"}
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/compare">
              <Scale className="size-3.5 text-accent" />
              Compare
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Download className="size-3.5" />
            Print / Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deleteDoc(doc.id);
              toast.success("Document deleted");
              navigate({ to: "/" });
            }}
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Document Header Card */}
      <div className="paper relative overflow-hidden p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                <Scale className="size-3" />
                {analysis?.documentType || "Indian Legal Document"}
              </span>
              <span className="text-xs text-muted-foreground">
                Added{" "}
                {new Date(doc.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            {isRenaming ? (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="max-w-md text-lg font-semibold"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    renameDoc(doc.id, newTitle);
                    setIsRenaming(false);
                    toast.success("Title updated");
                  }}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
                {doc.title}
                <button
                  type="button"
                  onClick={() => setIsRenaming(true)}
                  aria-label="Rename document"
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="size-4" />
                </button>
              </h1>
            )}

            {analysis?.jurisdictionNote && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="size-3.5 text-accent" />
                {analysis.jurisdictionNote}
              </p>
            )}
          </div>

          {/* Quick Stats Badges */}
          {analysis && (
            <div className="flex flex-wrap gap-2 md:justify-end">
              <div className="flex flex-col items-center rounded-lg border border-border/80 bg-surface/50 px-3 py-2 text-center">
                <span className="text-lg font-bold text-destructive">{highRisks.length}</span>
                <span className="text-[11px] font-medium text-muted-foreground">High Risks</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border/80 bg-surface/50 px-3 py-2 text-center">
                <span className="text-lg font-bold text-medium-foreground">
                  {analysis.clauses.length}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">Clauses</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border/80 bg-surface/50 px-3 py-2 text-center">
                <span className="text-lg font-bold text-accent">{analysis.obligations.length}</span>
                <span className="text-[11px] font-medium text-muted-foreground">Obligations</span>
              </div>
            </div>
          )}
        </div>

        {/* Goal / Specific Perspective Prompt */}
        {!analyzing && (
          <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {showGoalInput ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="e.g., I am the tenant / focus on notice period and deposit refund"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="text-xs"
                />
                <Button size="sm" onClick={() => runAnalysis(goal)} className="shrink-0">
                  Analyze with focus
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowGoalInput(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGoalInput(true)}
                className="text-accent underline hover:opacity-80"
              >
                + Customize analysis focus (e.g. your specific role or concerns)
              </button>
            )}
          </div>
        )}

        {/* Shimmering Analyzing State */}
        {analyzing && (
          <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-4 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-accent" />
            <p className="mt-2 font-display text-sm font-semibold text-foreground">
              Nyaya Mitra is analyzing this document…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reviewing clauses against Indian statutes, identifying red flags, and drafting lawyer
              consultation questions.
            </p>
          </div>
        )}
      </div>

      {/* Main Tabbed Content */}
      {analysis ? (
        <div className="mt-8 space-y-8" id="doc-tabs">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-surface p-1">
              <TabsTrigger
                value="overview"
                className="gap-1.5 py-2 text-xs font-semibold sm:text-sm"
              >
                <FileCheck className="size-4 text-accent" />
                Plain Summary
              </TabsTrigger>
              <TabsTrigger value="risks" className="gap-1.5 py-2 text-xs font-semibold sm:text-sm">
                <ShieldAlert className="size-4 text-destructive" />
                Red Flags ({analysis.risks.length})
              </TabsTrigger>
              <TabsTrigger
                value="clauses"
                className="gap-1.5 py-2 text-xs font-semibold sm:text-sm"
              >
                <FileText className="size-4 text-primary" />
                Clauses ({analysis.clauses.length})
              </TabsTrigger>
              <TabsTrigger
                value="obligations"
                className="gap-1.5 py-2 text-xs font-semibold sm:text-sm"
              >
                <UserCheck className="size-4" />
                Obligations ({analysis.obligations.length})
              </TabsTrigger>
              <TabsTrigger
                value="financials"
                className="gap-1.5 py-2 text-xs font-semibold sm:text-sm"
              >
                <IndianRupee className="size-4" />
                Key Dates & Money
              </TabsTrigger>
              <TabsTrigger value="lawyer" className="gap-1.5 py-2 text-xs font-semibold sm:text-sm">
                <HelpCircle className="size-4 text-accent" />
                Lawyer Prep ({analysis.questionsForLawyer.length})
              </TabsTrigger>
              <TabsTrigger
                value="checklist"
                className="gap-1.5 py-2 text-xs font-semibold sm:text-sm"
              >
                <CheckSquare className="size-4" />
                Checklist
              </TabsTrigger>
              <TabsTrigger value="ask" className="gap-1.5 py-2 text-xs font-semibold sm:text-sm">
                <MessageSquare className="size-4 text-accent" />
                Ask Nyaya Mitra
              </TabsTrigger>
              <TabsTrigger
                value="original"
                className="gap-1.5 py-2 text-xs font-semibold sm:text-sm"
              >
                <Layers className="size-4" />
                Full Text
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                {/* Summary points */}
                <div className="paper space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      Plain-Language Summary
                    </h2>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      Everyday English
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Here is what this document actually means in simple terms, without the confusing
                    legal jargon:
                  </p>
                  <ul className="space-y-3 pt-2">
                    {analysis.plainSummary.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-sm leading-relaxed text-foreground"
                      >
                        <CheckCircle2 className="mt-1 size-4 shrink-0 text-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-accent" />
                      <span className="text-xs font-medium text-foreground">
                        Have a question about what this means for you?
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveTab("ask");
                        setTimeout(() => {
                          document
                            .getElementById("doc-tabs")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                      }}
                      className="h-7 gap-1 text-xs text-accent border-accent/40 hover:bg-accent/10"
                    >
                      Ask Nyaya Mitra →
                    </Button>
                  </div>

                  {/* Red Flag Alert Highlight */}
                  {highRisks.length > 0 && (
                    <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                        <div>
                          <h4 className="text-sm font-semibold text-destructive">
                            {highRisks.length} High Risk Clause{highRisks.length > 1 ? "s" : ""}{" "}
                            Flagged
                          </h4>
                          <p className="mt-1 text-xs text-foreground/80">
                            This document contains terms that could lead to financial forfeiture,
                            loss of rights, or are unenforceable under Indian law.
                          </p>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="mt-3 text-xs"
                            onClick={() => setActiveTab("risks")}
                          >
                            Review Red Flags →
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Parties Card */}
                <div className="space-y-6">
                  <div className="paper p-6">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      Parties Involved
                    </h3>
                    <div className="mt-4 space-y-3">
                      {analysis.parties.map((p, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-border/80 bg-surface/40 p-3"
                        >
                          <p className="font-semibold text-foreground">
                            {p.name || "Party " + (idx + 1)}
                          </p>
                          <p className="text-xs font-medium text-accent">{p.role}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{p.plainRole}</p>
                        </div>
                      ))}
                      {analysis.parties.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No specific parties detected.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Missing Protections Box */}
                  {analysis.missing.length > 0 && (
                    <div className="paper p-6">
                      <h3 className="font-display text-base font-semibold text-foreground">
                        Missing Standard Protections
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Clauses that an Indian document of this kind normally includes for your
                        protection, but are missing here:
                      </p>
                      <ul className="mt-3 space-y-2">
                        {analysis.missing.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs text-muted-foreground"
                          >
                            <span className="mt-0.5 text-accent">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: RISKS & RED FLAGS */}
            <TabsContent value="risks" className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">
                    Risks & Legal Red Flags
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Clauses that are heavily one-sided, punitive, or legally void under Indian law.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
                    {highRisks.length} High
                  </span>
                  <span className="rounded-full bg-medium/15 px-3 py-1 text-xs font-semibold text-medium-foreground">
                    {mediumRisks.length} Medium
                  </span>
                </div>
              </div>

              <div className="grid gap-4">
                {analysis.risks.map((risk, index) => (
                  <div
                    key={index}
                    className={`paper p-5 transition-all ${
                      risk.severity === "high"
                        ? "border-destructive/40 bg-destructive/[0.02]"
                        : "border-border"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle
                          className={`size-5 shrink-0 ${
                            risk.severity === "high" ? "text-destructive" : "text-medium-foreground"
                          }`}
                        />
                        <h3 className="text-base font-semibold text-foreground">{risk.title}</h3>
                      </div>
                      <SeverityPill level={risk.severity} />
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {risk.explanation}
                    </p>

                    {risk.suggestion && (
                      <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                            What you should ask for instead (Counter-proposal):
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(risk.suggestion!, "Counter proposal")}
                            className="h-6 gap-1 px-2 text-[11px] text-accent hover:bg-accent/10"
                          >
                            <Copy className="size-3" />
                            Copy
                          </Button>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-foreground">
                          "{risk.suggestion}"
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const q = `Explain risk "${risk.title}" in this document: ${risk.explanation}. What does Indian statutory law state and how should I negotiate this?`;
                          setChatQuestion(q);
                          handleAsk(q);
                        }}
                        className="h-7 gap-1.5 text-xs text-accent hover:bg-accent/10"
                      >
                        <MessageSquare className="size-3.5" />
                        Ask Nyaya Mitra how to handle this
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(risk.title + ": " + risk.explanation, "Risk")
                        }
                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3" />
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}

                {analysis.risks.length === 0 && (
                  <div className="paper p-8 text-center">
                    <CheckCircle2 className="mx-auto size-8 text-low" />
                    <p className="mt-2 text-sm font-semibold">No high-risk red flags detected</p>
                    <p className="text-xs text-muted-foreground">
                      This document appears relatively standard, but always review the obligations
                      carefully.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: CLAUSES */}
            <TabsContent value="clauses" className="mt-6 space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">
                    Clause-by-Clause Breakdown
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Original legal wording alongside simple, plain-language translations.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clauses…"
                      value={clauseSearch}
                      onChange={(e) => setClauseSearch(e.target.value)}
                      className="pl-8 text-xs"
                    />
                  </div>
                  <select
                    value={clauseFilter}
                    onChange={(e) => setClauseFilter(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="all">All Importance</option>
                    <option value="high">High Importance</option>
                    <option value="medium">Medium Importance</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4">
                {filteredClauses.map((clause, idx) => (
                  <div key={idx} className="paper p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-foreground">
                          {clause.heading}
                        </h3>
                        <p className="mt-1 text-sm text-foreground/90 font-medium">
                          {clause.plain}
                        </p>
                      </div>
                      <SeverityPill level={clause.importance} />
                    </div>

                    {clause.quote && (
                      <div className="mt-3 rounded-lg border-l-2 border-accent bg-surface/50 p-3 text-xs italic text-muted-foreground">
                        <span className="font-semibold text-foreground/70 not-italic">
                          Quoted snippet:{" "}
                        </span>
                        "{clause.quote}"
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(clause.quote || clause.plain, "Clause text")}
                        className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3" />
                        Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const q = `Explain clause "${clause.heading}" in detail: what does "${clause.quote}" mean for me?`;
                          setChatQuestion(q);
                          handleAsk(q);
                          toast.info("Sent clause question to AI assistant below!");
                        }}
                        className="h-7 gap-1 text-xs text-accent hover:bg-accent/10"
                      >
                        <MessageSquare className="size-3" />
                        Ask AI about this clause
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredClauses.length === 0 && (
                  <div className="paper p-8 text-center text-xs text-muted-foreground">
                    No clauses matched your filter or search query.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 4: OBLIGATIONS */}
            <TabsContent value="obligations" className="mt-6 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Rights & Obligations
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Who is required to do what, and by when.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {analysis.obligations.map((ob, idx) => (
                  <div key={idx} className="paper p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground">
                        <UserCheck className="size-3 text-accent" />
                        {ob.who}
                      </span>
                      {ob.when && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          {ob.when}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-foreground">{ob.what}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 5: FINANCIALS & KEY DATES */}
            <TabsContent value="financials" className="mt-6 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Financials, Charges & Critical Dates
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  All money obligations, penalties, deductions, and key deadlines extracted from the
                  document.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Money & Deductions */}
                <div className="paper p-6">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="size-5 text-accent" />
                    <h3 className="font-display text-base font-semibold text-foreground">
                      Amounts & Deductions
                    </h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {analysis.money.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b border-border/50 pb-2.5"
                      >
                        <div>
                          <p className="text-xs font-medium text-foreground">{item.label}</p>
                          {item.note && (
                            <p className="text-[11px] text-muted-foreground">{item.note}</p>
                          )}
                        </div>
                        <span className="font-mono text-sm font-semibold text-accent">
                          {item.value}
                        </span>
                      </div>
                    ))}
                    {analysis.money.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No specific monetary terms found.
                      </p>
                    )}
                  </div>
                </div>

                {/* Key Dates & Term */}
                <div className="paper p-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-primary" />
                    <h3 className="font-display text-base font-semibold text-foreground">
                      Dates, Deadlines & Periods
                    </h3>
                  </div>
                  <div className="mt-4 space-y-3">
                    {analysis.keyDates.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b border-border/50 pb-2.5"
                      >
                        <div>
                          <p className="text-xs font-medium text-foreground">{item.label}</p>
                          {item.note && (
                            <p className="text-[11px] text-muted-foreground">{item.note}</p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                    {analysis.keyDates.length === 0 && (
                      <p className="text-xs text-muted-foreground">No specific dates detected.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 6: LAWYER CONSULTATION PREP */}
            <TabsContent value="lawyer" className="mt-6 space-y-6">
              <div className="paper p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-accent/15 p-2.5 text-accent">
                    <Scale className="size-6" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">
                      Prepare for a Legal Consultation
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Walk into an advocate's office with clear, specific questions. Don't waste
                      billable minutes on basic facts.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-border bg-surface/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Recommended Questions to Ask an Indian Advocate:
                  </p>
                  <ul className="mt-3 space-y-3">
                    {analysis.questionsForLawyer.map((q, idx) => (
                      <li
                        key={idx}
                        className="flex items-start justify-between gap-3 text-sm text-foreground"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-mono text-xs font-bold text-accent">
                            {idx + 1}.
                          </span>
                          <span>{q}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setChatQuestion(q);
                              handleAsk(q);
                              toast.info("Asked Nyaya Mitra!");
                            }}
                            className="h-7 gap-1 text-xs text-accent hover:bg-accent/10"
                          >
                            <MessageSquare className="size-3" />
                            Ask AI
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(q, "Question")}
                            className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="size-3" />
                            Copy
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">
                    Need free legal assistance? Contact <strong>NALSA</strong> helpline at{" "}
                    <strong>15100</strong>.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        analysis.questionsForLawyer.map((q, i) => `${i + 1}. ${q}`).join("\n"),
                        "All questions",
                      )
                    }
                  >
                    Copy All Questions
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 7: ACTION CHECKLIST */}
            <TabsContent value="checklist" className="mt-6 space-y-6">
              <div className="paper p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">
                      Pre-Signing & Action Checklist
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tick each step as you complete it before agreeing to this document.
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                    {Object.values(checkedItems).filter(Boolean).length} /{" "}
                    {analysis.checklist.length} Completed
                  </span>
                </div>

                <div className="mt-6 space-y-3">
                  {analysis.checklist.map((item, idx) => {
                    const key = `check-${idx}`;
                    const isChecked = !!checkedItems[key];
                    return (
                      <div
                        key={idx}
                        onClick={() => setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                          isChecked ? "border-low/40 bg-low/5" : "border-border hover:bg-surface/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 size-4 rounded border-border text-accent focus:ring-accent"
                        />
                        <div className="space-y-0.5">
                          <p
                            className={`text-sm font-semibold ${
                              isChecked ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {item.item}
                          </p>
                          {item.detail && (
                            <p className="text-xs text-muted-foreground">{item.detail}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {analysis.nextSteps.length > 0 && (
                  <div className="mt-8 border-t border-border pt-6">
                    <h3 className="font-display text-base font-semibold text-foreground">
                      Recommended Next Steps
                    </h3>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">
                      {analysis.nextSteps.map((step, idx) => (
                        <li key={idx}>
                          <span className="text-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB 8: FULL ORIGINAL TEXT */}
            <TabsContent value="original" className="mt-6 space-y-4">
              <div className="paper p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Original Document Content ({doc.text.length} characters)
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(doc.text, "Document text")}
                    className="gap-1.5"
                  >
                    <Copy className="size-3.5" />
                    Copy Original Text
                  </Button>
                </div>
                <div className="mt-4 max-h-[600px] overflow-y-auto rounded-lg border border-border bg-surface/40 p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {doc.text}
                </div>
              </div>
            </TabsContent>
            {/* TAB 9: ASK NYAYA MITRA */}
            <TabsContent value="ask" className="mt-6 space-y-4">
              <div className="paper overflow-hidden border-accent/30 p-6 shadow-lift">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-accent/15 p-2 text-accent">
                    <MessageSquare className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      Ask Nyaya Mitra about this document
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Grounded answers strictly based on this document and applicable Indian legal
                      principles.
                    </p>
                  </div>
                </div>

                {/* Quick Prompt Chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    "Can the landlord enter without notice?",
                    "Is the non-compete clause valid?",
                    "What happens if I terminate during lock-in?",
                    "Are the deductions fair under Indian law?",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setChatQuestion(chip);
                        handleAsk(chip);
                      }}
                      className="rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Conversation Log */}
                {chatHistory.length > 0 && (
                  <div className="mt-5 space-y-4 rounded-lg border border-border/80 bg-surface/30 p-4 max-h-[400px] overflow-y-auto">
                    {chatHistory.map((m, i) => (
                      <div
                        key={i}
                        className={`flex flex-col gap-1 text-xs ${
                          m.role === "user" ? "items-end" : "items-start"
                        }`}
                      >
                        <span className="font-semibold text-[10px] uppercase text-muted-foreground">
                          {m.role === "user" ? "You" : "Nyaya Mitra"}
                        </span>
                        <div
                          className={`rounded-lg p-3 max-w-[90%] leading-relaxed ${
                            m.role === "user"
                              ? "bg-primary text-primary-foreground font-medium whitespace-pre-wrap"
                              : "paper border-border/80 bg-card text-foreground"
                          }`}
                        >
                          {m.role === "user" ? (
                            m.text
                          ) : (
                            <LegalMarkdown
                              content={m.text}
                              isStreaming={chatBusy && i === chatHistory.length - 1}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                    {chatBusy && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-4 animate-spin text-accent" />
                        <span>Searching document clauses…</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Input */}
                <div className="mt-4 flex items-center gap-2">
                  <Input
                    placeholder="Ask anything about this document, notice period, deductions, or risks…"
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAsk();
                      }
                    }}
                    disabled={chatBusy}
                    className="text-sm"
                  />
                  <Button onClick={() => handleAsk()} disabled={chatBusy || !chatQuestion.trim()}>
                    {chatBusy ? <Loader2 className="size-4 animate-spin" /> : "Ask"}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </AppShell>
  );
}
