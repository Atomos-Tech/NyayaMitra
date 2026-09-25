import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  Copy,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquare,
  Plus,
  Scale,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { LegalMarkdown } from "@/components/LegalMarkdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createThread,
  deleteThread,
  updateThread,
  useDocs,
  useThreads,
  type Thread,
} from "@/lib/store";
import { answerIndianLegalQuery } from "@/lib/indian-legal-engine";
import { streamUnifiedLegalChat } from "@/lib/ai/ai-service";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { q?: string; docId?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
    docId: typeof search.docId === "string" ? search.docId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ask Nyaya Mitra — Grounded Legal Q&A" },
      {
        name: "description",
        content:
          "Ask questions about Indian law or get grounded answers from your uploaded rent agreements, employment contracts, and policies.",
      },
    ],
  }),
  component: ChatPage,
});

const SUGGESTED_QUESTIONS = [
  "Is a post-employment non-compete clause legally valid in India?",
  "Can my landlord deduct painting charges automatically from my deposit?",
  "What is the statutory timeline to respond to a Section 138 cheque bounce notice?",
  "Can an employer withhold my relieving letter if I resign?",
  "What interest rate can an MSME claim for delayed payments under the MSMED Act?",
  "What are the rights of a tenant under the Model Tenancy Act 2021?",
];

function ChatPage() {
  const search = Route.useSearch();
  const docs = useDocs();
  const threads = useThreads();

  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchHandledRef = useRef(false);

  // Initialize or pick thread
  useEffect(() => {
    if (threads.length > 0 && !activeThreadId) {
      setActiveThreadId(threads[0].id);
      setSelectedDocIds(threads[0].docIds || []);
    } else if (threads.length === 0 && !activeThreadId) {
      const newT = createThread({ title: "Indian Legal Advice & Q&A" });
      setActiveThreadId(newT.id);
    }
  }, [threads.length]);

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  useEffect(() => {
    if (activeThread) {
      setSelectedDocIds(activeThread.docIds || []);
    }
  }, [activeThread?.id]);

  // Handle incoming search query (e.g. from Guide or Doc page)
  useEffect(() => {
    if (search.docId && !selectedDocIds.includes(search.docId)) {
      setSelectedDocIds((prev) => [...prev, search.docId!]);
    }
  }, [search.docId]);

  useEffect(() => {
    if (search.q && !searchHandledRef.current) {
      searchHandledRef.current = true;
      setInputMessage(search.q);
    }
  }, [search.q]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThread?.messages?.length, busy]);

  const toggleDocSelection = (id: string) => {
    const updated = selectedDocIds.includes(id)
      ? selectedDocIds.filter((d) => d !== id)
      : selectedDocIds.length < 4
        ? [...selectedDocIds, id]
        : selectedDocIds;
    setSelectedDocIds(updated);
    if (activeThread) {
      updateThread(activeThread.id, { docIds: updated });
    }
  };

  const handleNewChat = () => {
    const t = createThread({ title: "New Legal Consultation", docIds: selectedDocIds });
    setActiveThreadId(t.id);
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend) return;

    // Ensure thread always exists
    let thread = activeThread;
    if (!thread) {
      thread = createThread({
        title: textToSend.slice(0, 45) + (textToSend.length > 45 ? "…" : ""),
        docIds: selectedDocIds,
      });
      setActiveThreadId(thread.id);
    }

    setInputMessage("");

    // Build user message
    const userMsg = {
      id: Math.random().toString(),
      role: "user" as const,
      parts: [{ type: "text" as const, text: textToSend }],
    };

    const updatedMessages = [...(thread.messages || []), userMsg];
    updateThread(thread.id, {
      messages: updatedMessages,
      title:
        thread.messages.length === 0
          ? textToSend.slice(0, 45) + (textToSend.length > 45 ? "…" : "")
          : thread.title,
    });

    setBusy(true);

    // Filter attached documents
    const attachedDocs = docs
      .filter((d) => selectedDocIds.includes(d.id))
      .map((d) => ({ title: d.title, text: d.text }));

    const assistantMsgId = Math.random().toString();
    const placeholderMsg = {
      id: assistantMsgId,
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "" }],
    };
    updateThread(thread.id, {
      messages: [...updatedMessages, placeholderMsg],
    });

    try {
      const formattedMessages = updatedMessages.map((m) => {
        const textContent =
          m.parts
            ?.filter((p) => p.type === "text")
            .map((p) => (p as { text: string }).text)
            .join("") || "";
        return {
          role: m.role as "user" | "assistant",
          content: textContent,
        };
      });

      const reply = await streamUnifiedLegalChat({
        messages: formattedMessages,
        documents: attachedDocs,
        onChunk: (_delta, accumulated) => {
          updateThread(thread.id, {
            messages: [
              ...updatedMessages,
              {
                id: assistantMsgId,
                role: "assistant" as const,
                parts: [{ type: "text" as const, text: accumulated }],
              },
            ],
          });
        },
      });

      updateThread(thread.id, {
        messages: [
          ...updatedMessages,
          {
            id: assistantMsgId,
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: reply }],
          },
        ],
      });
    } catch {
      const fallbackReply = answerIndianLegalQuery(textToSend, attachedDocs);
      updateThread(thread.id, {
        messages: [
          ...updatedMessages,
          {
            id: assistantMsgId,
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: fallbackReply }],
          },
        ],
      });
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Answer copied to clipboard!");
  };

  return (
    <AppShell className="max-w-6xl">
      <div className="grid h-[calc(100vh-140px)] gap-6 lg:grid-cols-[280px_1fr]">
        {/* SIDEBAR: THREADS & ATTACHED DOCS */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          {/* New Chat Button */}
          <Button onClick={handleNewChat} className="w-full justify-start gap-2 shadow-sm">
            <Plus className="size-4" />
            New Conversation
          </Button>

          {/* Document Grounding Selector */}
          <div className="paper p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                Ground in Documents
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedDocIds.length} attached
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Select documents to quote directly in answers:
            </p>

            <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              {docs.map((d) => {
                const isSelected = selectedDocIds.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDocSelection(d.id)}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? "bg-accent/15 font-semibold text-accent"
                        : "hover:bg-secondary text-muted-foreground"
                    }`}
                  >
                    <span className="truncate pr-2">{d.title}</span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-accent" />}
                  </button>
                );
              })}
              {docs.length === 0 && (
                <div className="py-2 text-center text-xs text-muted-foreground">
                  <p>No documents uploaded.</p>
                  <Button asChild variant="link" size="sm" className="h-6 text-xs text-accent">
                    <Link to="/">Add a document →</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Past Conversations List */}
          <div className="paper flex-1 p-4 overflow-y-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Conversations
            </span>
            <div className="mt-3 space-y-1">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors ${
                    t.id === activeThreadId
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveThreadId(t.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{t.title}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                      if (t.id === activeThreadId && threads.length > 1) {
                        const remaining = threads.filter((th) => th.id !== t.id);
                        setActiveThreadId(remaining[0].id);
                      }
                      toast.success("Conversation deleted");
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className="paper flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-border/80 bg-surface/40 px-6 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Scale className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  {activeThread?.title || "Legal Assistant"}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {selectedDocIds.length > 0
                    ? `Grounded in ${selectedDocIds.length} attached document(s)`
                    : "Answering general Indian legal information"}
                </p>
              </div>
            </div>

            {selectedDocIds.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Active:</span>
                {docs
                  .filter((d) => selectedDocIds.includes(d.id))
                  .map((d) => (
                    <span
                      key={d.id}
                      className="rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent max-w-[120px] truncate"
                    >
                      {d.title}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Messages Container */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
            {(!activeThread?.messages || activeThread.messages.length === 0) && (
              <div className="py-10 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Sparkles className="size-6" />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold text-foreground">
                  How can Nyaya Mitra assist you?
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  Ask any question regarding your tenancy rights, employment obligations, cheque
                  bounce notices, consumer disputes, or specific clauses in your agreements.
                </p>

                {/* Suggestions Grid */}
                <div className="mt-6 grid gap-2 max-w-xl mx-auto sm:grid-cols-2 text-left">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleSend(q)}
                      className="rounded-lg border border-border bg-surface/50 p-3 text-xs text-foreground transition-all hover:border-accent hover:bg-accent/5 hover:text-accent"
                    >
                      <p className="font-medium">{q}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeThread?.messages?.map((msg, index) => {
              const textContent =
                msg.parts
                  ?.filter((p) => p.type === "text")
                  .map((p) => (p as { text: string }).text)
                  .join("") || "";

              const isUser = msg.role === "user";

              return (
                <div
                  key={index}
                  className={`flex gap-3 text-sm ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent mt-1">
                      <Bot className="size-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] space-y-1.5 ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground font-medium rounded-tr-none whitespace-pre-wrap"
                          : "paper border-border/80 bg-card text-foreground rounded-tl-none"
                      }`}
                    >
                      {isUser ? (
                        textContent
                      ) : (
                        <LegalMarkdown
                          content={textContent}
                          isStreaming={busy && index === (activeThread?.messages?.length ?? 0) - 1}
                        />
                      )}
                    </div>

                    {!isUser && (
                      <div className="flex items-center gap-2 pl-1">
                        <button
                          type="button"
                          onClick={() => copyMessage(textContent)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="size-3" />
                          Copy
                        </button>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground mt-1">
                      <User className="size-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Bot className="size-4" />
                </div>
                <div className="paper flex items-center gap-2 rounded-2xl rounded-tl-none px-4 py-2.5">
                  <Loader2 className="size-3.5 animate-spin text-accent" />
                  <span>Thinking with Indian legal context…</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="border-t border-border/80 bg-surface/50 p-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Ask about a clause, Indian statutory law, or next steps…"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={busy}
                className="bg-background text-sm"
              />
              <Button
                onClick={() => handleSend()}
                disabled={busy || !inputMessage.trim()}
                className="shrink-0 gap-1.5 font-semibold"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Nyaya Mitra provides legal information, not formal representation. For court notices
              or disputes, consult an advocate.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
