"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExtractionStatus as Status } from "@/app/api/jobs/extraction-status/route";

// How far skills, pay and summaries have been read out of the postings, with a
// way to catch up on the ones still waiting. Lives in the header's ⋯ menu and
// refreshes itself while there is reading going on.

const POLL_MS = 4000;

export function ExtractionStatus({ canStart }: { canStart: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  // Waiting is not the same as being read: reading starts on import, or here.
  const [started, setStarted] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/extraction-status");
      const body = await res.json();
      if (!body.success) throw new Error(body.error);
      setStatus(body.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  const busy = started && (status?.kinds.some((k) => k.waiting > 0) ?? false);

  useEffect(() => {
    const first = setTimeout(load, 0);
    if (!busy) return () => clearTimeout(first);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, busy]);

  const start = async (retryFailed: boolean) => {
    setStarting(true);
    try {
      await fetch("/api/jobs/extraction-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retryFailed }),
      });
      setStarted(true);
      await load();
    } finally {
      setStarting(false);
    }
  };

  if (error) return <p className="px-2.5 py-2 text-xs text-stone">Couldn&apos;t read the extraction status.</p>;
  if (!status) return <p className="px-2.5 py-2 text-xs text-stone">Checking postings…</p>;

  const waiting = status.kinds.reduce((n, k) => n + k.waiting, 0);
  const failed = status.kinds.reduce((n, k) => n + k.failed, 0);

  return (
    <div className="px-2.5 py-2 space-y-1.5">
      <p className="text-[12.5px] font-medium text-charcoal">Read from postings</p>
      <ul className="space-y-0.5">
        {status.kinds.map((k) => (
          <li key={k.kind} className="flex items-baseline justify-between gap-3 text-xs tabular-nums">
            <span className="text-slate">{k.label}</span>
            <span className="text-charcoal">
              {k.done}/{status.total}
              {k.waiting > 0 && <span className="text-fair"> · {k.waiting} waiting</span>}
              {k.failed > 0 && <span className="text-poor"> · {k.failed} failed</span>}
            </span>
          </li>
        ))}
      </ul>
      {status.withoutDetail > 0 && (
        <p className="text-[11px] text-stone">{status.withoutDetail} postings have no details scraped yet.</p>
      )}
      {canStart && (waiting > 0 || failed > 0) && (
        <div className="flex gap-1.5 pt-0.5">
          {waiting > 0 && (
            <button
              onClick={() => start(false)}
              disabled={starting}
              className="h-7 px-2.5 rounded-md border border-hairline text-xs font-medium text-charcoal hover:bg-surface disabled:opacity-50"
            >
              {starting ? "Starting…" : `Read ${waiting} now`}
            </button>
          )}
          {failed > 0 && (
            <button
              onClick={() => start(true)}
              disabled={starting}
              className="h-7 px-2.5 rounded-md border border-hairline text-xs font-medium text-poor hover:bg-surface disabled:opacity-50"
            >
              Retry {failed} failed
            </button>
          )}
        </div>
      )}
      {busy && <p className="text-[11px] text-stone">Reading in the background — this updates as it goes.</p>}
    </div>
  );
}
