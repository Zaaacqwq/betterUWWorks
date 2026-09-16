"use client";

import type { LineScores } from "@/hooks/use-line-scores";

// How far the server has got checking the open postings against the
// student's resume. Scores marked ~ are estimates until their posting is done.
export function CheckProgress({ progress }: { progress: LineScores }) {
  const { total, checked, running, paused, retrying } = progress;
  if (total === 0 || (checked >= total && !paused)) return null;
  const pct = Math.round((checked / total) * 100);

  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
        <span className="text-slate">
          {paused
            ? "Today's resume checks are used up — this version is checked tomorrow"
            : retrying > 0 && checked + retrying >= total
              ? `Trying ${retrying} posting${retrying === 1 ? "" : "s"} again in a moment`
              : running
                ? "Checking postings against your resume"
                : "Some postings are waiting to be checked"}
        </span>
        <span className="text-stone tabular-nums shrink-0">
          {checked.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div className="h-1 rounded-full bg-hairline-soft overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-stone">Scores marked ~ are estimates until their posting has been checked.</p>
    </div>
  );
}
