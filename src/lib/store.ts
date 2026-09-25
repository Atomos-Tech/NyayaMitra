import { useSyncExternalStore } from "react";
import type { UIMessage } from "ai";

import type { Analysis, LegalDoc } from "./legal-types";

export type Thread = {
  id: string;
  title: string;
  docIds: string[];
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
};

const DOCS_KEY = "nyaya.docs.v1";
const THREADS_KEY = "nyaya.threads.v1";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
}

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save to this browser", error);
  }
  emit();
}

let docsCache: LegalDoc[] = [];
let docsCacheRaw = "";
let threadsCache: Thread[] = [];
let threadsCacheRaw = "";

function snapshotDocs(): LegalDoc[] {
  if (typeof window === "undefined") return docsCache;
  const raw = window.localStorage.getItem(DOCS_KEY) ?? "";
  if (raw !== docsCacheRaw) {
    docsCacheRaw = raw;
    docsCache = read<LegalDoc>(DOCS_KEY);
  }
  return docsCache;
}

function snapshotThreads(): Thread[] {
  if (typeof window === "undefined") return threadsCache;
  const raw = window.localStorage.getItem(THREADS_KEY) ?? "";
  if (raw !== threadsCacheRaw) {
    threadsCacheRaw = raw;
    threadsCache = read<Thread>(THREADS_KEY);
  }
  return threadsCache;
}

const emptyDocs: LegalDoc[] = [];
const emptyThreads: Thread[] = [];

export function useDocs(): LegalDoc[] {
  return useSyncExternalStore(subscribe, snapshotDocs, () => emptyDocs);
}

export function useDoc(id: string | undefined): LegalDoc | undefined {
  const docs = useDocs();
  return docs.find((doc) => doc.id === id);
}

export function useThreads(): Thread[] {
  return useSyncExternalStore(subscribe, snapshotThreads, () => emptyThreads);
}

export function useThread(id: string | undefined): Thread | undefined {
  const threads = useThreads();
  return threads.find((thread) => thread.id === id);
}

export function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function addDoc(input: { title: string; text: string; source: string }): LegalDoc {
  const doc: LegalDoc = {
    id: newId(),
    title: input.title.trim() || "Untitled document",
    text: input.text,
    source: input.source,
    createdAt: Date.now(),
  };
  write(DOCS_KEY, [doc, ...snapshotDocs()]);
  return doc;
}

export function saveAnalysis(docId: string, analysis: Analysis) {
  write(
    DOCS_KEY,
    snapshotDocs().map((doc) =>
      doc.id === docId ? { ...doc, analysis, title: doc.title || analysis.title } : doc,
    ),
  );
}

export function renameDoc(docId: string, title: string) {
  write(
    DOCS_KEY,
    snapshotDocs().map((doc) => (doc.id === docId ? { ...doc, title } : doc)),
  );
}

export function deleteDoc(docId: string) {
  write(
    DOCS_KEY,
    snapshotDocs().filter((doc) => doc.id !== docId),
  );
}

export function createThread(input?: { title?: string; docIds?: string[] }): Thread {
  const thread: Thread = {
    id: newId(),
    title: input?.title?.trim() || "New conversation",
    docIds: input?.docIds ?? [],
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  write(THREADS_KEY, [thread, ...snapshotThreads()]);
  return thread;
}

export function updateThread(threadId: string, patch: Partial<Omit<Thread, "id">>) {
  const existing = snapshotThreads();
  if (!existing.some((thread) => thread.id === threadId)) return;
  write(
    THREADS_KEY,
    existing.map((thread) =>
      thread.id === threadId ? { ...thread, ...patch, updatedAt: Date.now() } : thread,
    ),
  );
}

export function ensureThread(threadId: string, docIds: string[] = []): Thread {
  const existing = snapshotThreads().find((thread) => thread.id === threadId);
  if (existing) return existing;
  const thread: Thread = {
    id: threadId,
    title: "New conversation",
    docIds,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  write(THREADS_KEY, [thread, ...snapshotThreads()]);
  return thread;
}

export function deleteThread(threadId: string) {
  write(
    THREADS_KEY,
    snapshotThreads().filter((thread) => thread.id !== threadId),
  );
}

export function titleFromText(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 3);
  if (!firstLine) return "Untitled document";
  return firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
}
