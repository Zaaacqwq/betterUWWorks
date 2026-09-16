"use client";

import { useCallback, useSyncExternalStore } from "react";

// A set of job ids kept in this browser — the saved ones, the ones a student
// has turned down. Both behave the same way, so both are this store under a
// different key.

const listeners = new Map<string, Set<() => void>>();
const cached = new Map<string, { raw: string; ids: string[] }>();
const EMPTY: string[] = [];

function read(key: string): string[] {
  const raw = localStorage.getItem(key) ?? "";
  const seen = cached.get(key);
  if (!seen || seen.raw !== raw) {
    let ids: string[] = EMPTY;
    try {
      ids = raw ? JSON.parse(raw) : EMPTY;
    } catch {
      ids = EMPTY;
    }
    cached.set(key, { raw, ids });
    return ids;
  }
  return seen.ids;
}

function subscribeTo(key: string) {
  return (cb: () => void) => {
    const set = listeners.get(key) ?? new Set();
    set.add(cb);
    listeners.set(key, set);
    return () => set.delete(cb);
  };
}

export interface JobIdSet {
  ids: string[];
  has: (jobId: string) => boolean;
  toggle: (jobId: string) => void;
  count: number;
}

export function useJobIdSet(key: string): JobIdSet {
  const ids = useSyncExternalStore(
    subscribeTo(key),
    () => read(key),
    () => EMPTY
  );

  const toggle = useCallback(
    (jobId: string) => {
      const current = read(key);
      const next = current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId];
      localStorage.setItem(key, JSON.stringify(next));
      listeners.get(key)?.forEach((cb) => cb());
    },
    [key]
  );

  const has = useCallback((jobId: string) => ids.includes(jobId), [ids]);

  return { ids, has, toggle, count: ids.length };
}
