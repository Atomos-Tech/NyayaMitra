import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileText, Loader2, Scale, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractTextFromFile } from "@/lib/extract-text";
import { addDoc, deleteDoc, titleFromText, useDocs } from "@/lib/store";
import { SAMPLE_DOCUMENTS } from "@/lib/samples";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nyaya Mitra — Understand any Indian legal document" },
      {
        name: "description",
        content:
          "Paste or upload a rent agreement, offer letter, loan or policy and get a plain-language summary, risks, obligations and next steps for India.",
      },
      { property: "og:title", content: "Nyaya Mitra — Understand any Indian legal document" },
      {
        property: "og:description",
        content:
          "Plain-language summaries, clause-by-clause risk flags, document comparison and grounded answers for Indian legal documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const docs = useDocs();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const save = (docTitle: string, docText: string, source: string) => {
    if (docText.trim().length < 40) {
      toast.error("That looks too short. Paste at least a paragraph of the document.");
      return;
    }
    const doc = addDoc({ title: docTitle || titleFromText(docText), text: docText, source });
    setTitle("");
    setText("");
    navigate({ to: "/doc/$docId", params: { docId: doc.id } });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const extracted = await extractTextFromFile(file);
      save(title || file.name.replace(/\.[^.]+$/, ""), extracted, file.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppShell>
      <section className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
            <Scale className="size-3.5" /> Built for Indian documents
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Read the fine print
            <span className="block text-accent">before you sign it.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Add a rent agreement, offer letter, loan sanction letter, insurance policy, vendor
            contract or legal notice. Nyaya Mitra explains it line by line in plain words, flags the
            clauses that can hurt you, compares two versions, and helps you walk into a lawyer's
            office prepared.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              {
                heading: "Plain-language summary",
                detail: "Every clause, in everyday English",
                to: undefined,
              },
              {
                heading: "Risk & red flag alerts",
                detail: "One-sided terms, penalties, missing protections",
                to: undefined,
              },
              {
                heading: "Ask your document",
                detail: "Grounded answers with quoted lines",
                to: "/chat",
              },
              {
                heading: "Compare two versions",
                detail: "See exactly what changed and who it favours",
                to: "/compare",
              },
            ].map(({ heading, detail, to }) => (
              <li key={heading} className="paper p-4 transition-all hover:border-accent/40">
                {to ? (
                  <Link to={to} className="block group">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                        {heading}
                      </p>
                      <span className="text-xs text-accent">Open →</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                  </Link>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-foreground">{heading}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="paper p-6">
          <h2 className="text-xl font-semibold text-foreground">Add a document</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It stays in this browser. Nothing is stored on a server.
          </p>

          <label className="mt-5 block text-sm font-medium text-foreground" htmlFor="doc-title">
            Give it a name (optional)
          </label>
          <Input
            id="doc-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Flat 302 rent agreement"
            className="mt-1.5"
          />

          <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="doc-text">
            Paste the text
          </label>
          <Textarea
            id="doc-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={9}
            placeholder="Paste the agreement, notice, policy or offer letter here…"
            className="mt-1.5 resize-y font-sans text-sm"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => save(title, text, "Pasted text")} disabled={busy}>
              Analyse document
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.csv,text/plain,application/pdf"
              className="hidden"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload PDF or text
            </Button>
          </div>

          <div className="mt-5 rounded-lg bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              No document handy? Try a sample
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLE_DOCUMENTS.map((sample) => (
                <Button
                  key={sample.title}
                  size="sm"
                  variant="secondary"
                  onClick={() => save(sample.title, sample.text, "Sample document")}
                >
                  {sample.title}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold text-foreground">Your documents</h2>
          {docs.length > 1 ? (
            <Link to="/compare" className="text-sm font-medium text-accent hover:underline">
              Compare two documents →
            </Link>
          ) : null}
        </div>
        <div className="mt-2 rule-line" />

        {docs.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Nothing here yet. Add your first document above.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((doc) => (
              <li key={doc.id} className="paper flex flex-col p-5">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-accent" />
                  <Link
                    to="/doc/$docId"
                    params={{ docId: doc.id }}
                    className="font-display text-base font-semibold leading-snug text-foreground hover:text-accent"
                  >
                    {doc.title}
                  </Link>
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {doc.analysis?.plainSummary[0] ?? doc.text.slice(0, 180)}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {doc.analysis ? doc.analysis.documentType : "Not analysed yet"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${doc.title}`}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    onClick={() => {
                      deleteDoc(doc.id);
                      toast.success("Document removed from this browser.");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
