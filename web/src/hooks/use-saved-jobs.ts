"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "buw-saved-jobs";

function getSnapshot(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const EMPTY: string[] = [];
function getServerSnapshot(): string[] {
  return EMPTY;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function persist(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  for (const cb of listeners) cb();
}

let cachedSnapshot: string[] | null = null;
let cachedRaw: string | null = null;

function stableSnapshot(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = raw ? JSON.parse(raw) : [];
  }
  return cachedSnapshot!;
}

export function useSavedJobs() {
  const savedIds = useSyncExternalStore(subscribe, stableSnapshot, getServerSnapshot);

  const toggle = useCallback((jobId: string) => {
    const current = getSnapshot();
    const next = current.includes(jobId)
      ? current.filter((id) => id !== jobId)
      : [...current, jobId];
    persist(next);
  }, []);

  const isSaved = useCallback(
    (jobId: string) => savedIds.includes(jobId),
    [savedIds]
  );

  return { savedIds, toggle, isSaved, count: savedIds.length };
}
