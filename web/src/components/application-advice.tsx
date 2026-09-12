"use client";

import { useCallback, useMemo, useState } from "react";
import { useResume } from "@/hooks/use-resume";
import type { ApplicationAdvice as Advice } from "@/lib/match-advice/types";
import type { JobDetail } from "./types/job";
import { TargetIcon, WarningIcon } from "./icons";

// How to apply to this posting with this resume: what to lead with, how to
// handle the gaps, what to check first. The match itself is the breakdown
// above; this only advises on it. Kept per resume and posting in the browser,
// so reopening the posting doesn't ask the model again.

const CACHE_PREFIX = "buw-advice:";

function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return h.toString(36);
}

function readCache(key: string): Advice | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Advice) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, advice: Advice) {
  try {
    localStorage.setItem(key, JSON.stringify(advice));
  } catch {
    // Full or blocked storage only costs asking again next time.
  }
}

type State = { state: "idle" } | { state: "loading" } | { state: "done"; advice: Advice } | { state: "error"; message: string };

export function ApplicationAdvice({ job }: { job: JobDetail }) {
  const { profile, userInfo, extraSkills, skillLevels } = useResume();
  const cacheKey = useMemo(
    () =>
      CACHE_PREFIX +
      job.jobId +
      ":" +
      hash(
        JSON.stringify([profile?.extractedAt, userInfo, extraSkills, skillLevels, job.aiSkillsAt, job.aiDetailsAt, job.aiSummary])
      ),
    [job.jobId, job.aiSkillsAt, job.aiDetailsAt, job.aiSummary, profile?.extractedAt, userInfo, extraSkills, skillLevels]
  );
  const [result, setResult] = useState<{ key: string; value: State } | null>(null);
  // This panel only renders in the browser, after the posting has been fetched.
  const cached = useMemo(() => readCache(cacheKey), [cacheKey]);

  const current: State =
    result?.key === cacheKey ? result.value : cached ? { state: "done", advice: cached } : { state: "idle" };

  const generate = useCallback(async () => {
    if (!profile) return;
    setResult({ key: cacheKey, value: { state: "loading" } });
    try {
      const res = await fetch(`/api/jobs/${job.jobId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, userInfo, extraSkills, skillLevels }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) throw new Error(body?.error ?? `HTTP ${res.status}`);
      writeCache(cacheKey, body.data);
      setResult({ key: cacheKey, value: { state: "done", advice: body.data } });
    } catch (e: unknown) {
      setResult({
        key: cacheKey,
        value: { state: "error", message: e instanceof Error ? e.message : "Couldn't get advice" },
      });
    }
  }, [cacheKey, job.jobId, profile, userInfo, extraSkills, skillLevels]);

  if (!profile) return null;

  return (
    <section className="space-y-2.5 pt-5 border-t border-hairline-soft">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-[13.5px] font-semibold text-ink">Application advice</h4>
        {current.state === "done" && (
          <button onClick={generate} className="text-xs text-stone hover:text-charcoal transition-colors">
            Ask again
          </button>
        )}
      </div>

      {current.state === "idle" && (
        <>
          <p className="text-[13px] text-slate">
            Which of your experience to lead with, how to handle the skills you&apos;re missing, and what to check before applying.
          </p>
          <button
            onClick={generate}
            className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg border border-hairline bg-canvas text-[12.5px] font-medium text-charcoal hover:bg-surface transition-colors"
          >
            <TargetIcon className="w-3.5 h-3.5 text-primary" />
            Get application advice
          </button>
        </>
      )}

      {current.state === "loading" && (
        <div className="space-y-2 py-1" aria-live="polite">
          <p className="text-xs text-stone animate-pulse">Reading your resume against the posting…</p>
          <div className="h-3 bg-hairline rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-hairline rounded w-1/2 animate-pulse" />
        </div>
      )}

      {current.state === "error" && (
        <div className="flex items-center justify-between gap-3 rounded-[10px] bg-error/5 px-4 py-3">
          <p className="text-[13px] text-poor">Couldn&apos;t get advice ({current.message}).</p>
          <button onClick={generate} className="text-[12.5px] font-medium text-charcoal hover:underline shrink-0">
            Try again
          </button>
        </div>
      )}

      {current.state === "done" && <AdviceBody advice={current.advice} />}
    </section>
  );
}

function AdviceBody({ advice }: { advice: Advice }) {
  const empty = advice.highlights.length === 0 && advice.gaps.length === 0 && advice.checks.length === 0;
  if (empty) {
    return <p className="text-[13px] text-slate">Nothing specific to advise — this posting&apos;s skills haven&apos;t been read yet, or none of them connect to your resume.</p>;
  }

  return (
    <div className="space-y-4">
      {advice.checks.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[12.5px] font-semibold text-charcoal">Check before applying</p>
          <ul className="space-y-1">
            {advice.checks.map((check) => (
              <li key={check} className="flex items-start gap-2 text-[13px] text-fair">
                <WarningIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {check}
              </li>
            ))}
          </ul>
        </div>
      )}

      {advice.highlights.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12.5px] font-semibold text-charcoal">Lead with</p>
          {advice.highlights.map((h) => (
            <div key={h.experience} className="space-y-1">
              <p className="text-[13px] text-ink">
                <span className="font-medium">{h.experience}</span>
                <span className="text-steel"> — {h.skills.join(", ")}</span>
              </p>
              <p className="text-[13px] text-charcoal leading-relaxed max-w-[72ch]">{h.why}</p>
            </div>
          ))}
        </div>
      )}

      {advice.gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12.5px] font-semibold text-charcoal">Address the gaps</p>
          {advice.gaps.map((g) => (
            <div key={g.skill} className="space-y-1">
              <p className="text-[13px] font-medium text-ink">{g.skill}</p>
              <p className="text-[13px] text-charcoal leading-relaxed max-w-[72ch]">{g.suggestion}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-stone">Advice from AI, built on the match above. Skills it mentions are ones this posting names.</p>
    </div>
  );
}
