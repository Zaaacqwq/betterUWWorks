"use client";

import { useEffect, useState } from "react";
import { onResumePushed } from "./use-resume";

// Skills scores the server has checked line by line against the student's
// resume, and how far that checking has got. Asked for again every few
// seconds while checks are still coming in, and after every resume change.

export interface LineScores {
  version: number;
  // Out of 70, by job id.
  scores: Record<string, number>;
  total: number;
  checked: number;
  running: boolean;
  // Postings whose check failed and is waiting to be tried again.
  retrying: number;
  paused: boolean;
}

const POLL_MS = 6000;

export function useLineScores(enabled: boolean): LineScores | null {
  const [data, setData] = useState<LineScores | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    async function load() {
      if (timer) clearTimeout(timer);
      controller?.abort();
      const ac = new AbortController();
      controller = ac;
      try {
        const res = await fetch("/api/match/scores", { signal: ac.signal });
        const json = await res.json();
        if (!json?.success) return;
        const next = json.data as LineScores | null;
        setData(next);
        if (next?.running) timer = setTimeout(load, POLL_MS);
      } catch {
        // Aborted by a newer request, or offline: the next change asks again.
      }
    }

    // Fetched once here, then again after every change the server has taken.
    const first = setTimeout(load, 0);
    const off = onResumePushed(() => void load());
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(first);
      off();
      window.removeEventListener("focus", onFocus);
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled]);

  return enabled ? data : null;
}
