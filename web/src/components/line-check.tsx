"use client";

import { useEffect, useState } from "react";
import { onResumePushed } from "@/hooks/use-resume";
import type { CheckDetail, CheckedLine } from "@/lib/line-check/detail";

// The posting read line by line against the student's resume: what each line
// asks, whether the resume shows it, and the resume line that does. A posting
// not checked yet is checked on the spot.

type State =
  | { kind: "loading" }
  | { kind: "checking" }
  | { kind: "failed" }
  | { kind: "ready"; detail: CheckDetail };

const UPDATE_POLL_MS = 5000;

const GRADE_CHIP: Record<number, { label: string; className: string }> = {
  2: { label: "Met", className: "bg-good/10 text-good" },
  1: { label: "Partly", className: "bg-fair/10 text-fair" },
  0: { label: "Not shown", className: "bg-poor/10 text-poor" },
  [-1]: { label: "Not scored", className: "bg-hairline-soft text-steel" },
};

const UNSCORED_REASON: Record<string, string> = {
  eligibility: "Eligibility — see the warnings above",
  outcome: "What you'd gain",
  heading: "Heading",
  other: "About the company or the posting",
};

export function LineCheck({ jobId }: { jobId: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  // Bumped by "Try again" to run the effect afresh.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let poll: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      if (poll) clearTimeout(poll);
      try {
        const got = await fetchDetail(jobId, "GET", controller.signal);
        if (got.status !== "pending") {
          setState({ kind: "ready", detail: got });
          if (got.status === "checked" && got.updating) poll = setTimeout(load, UPDATE_POLL_MS);
          return;
        }
        setState({ kind: "checking" });
        const checked = await fetchDetail(jobId, "POST", controller.signal);
        setState(checked.status === "pending" ? { kind: "failed" } : { kind: "ready", detail: checked });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setState({ kind: "failed" });
      }
    }

    void load();
    const off = onResumePushed(() => void load());
    return () => {
      controller.abort();
      off();
      if (poll) clearTimeout(poll);
    };
  }, [jobId, attempt]);

  // A posting not split into lines yet has nothing to show here.
  if (state.kind === "ready" && state.detail.status !== "checked") return null;

  return (
    <section className="space-y-2.5">
      <h4 className="text-[13.5px] font-semibold text-ink">Line by line</h4>
      {state.kind === "loading" ? (
        <p className="text-[13px] text-stone">Loading the line-by-line check…</p>
      ) : state.kind === "checking" ? (
        <p className="text-[13px] text-slate animate-pulse">Checking each line of this posting against your resume…</p>
      ) : state.kind === "failed" ? (
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate">
          <span>Couldn&apos;t check this posting just now. It&apos;s retried in the background.</span>
          <button onClick={() => setAttempt((n) => n + 1)} className="text-primary font-medium hover:underline">
            Try again
          </button>
        </div>
      ) : state.detail.status === "checked" ? (
        <CheckedLines detail={state.detail} />
      ) : null}
    </section>
  );
}

function CheckedLines({ detail }: { detail: Extract<CheckDetail, { status: "checked" }> }) {
  const [showUnscored, setShowUnscored] = useState(false);

  const scored = detail.lines.filter((l) => l.weight > 0);
  const unscored = detail.lines.filter((l) => l.weight === 0 && l.kind !== "heading");
  const met = scored.filter((l) => l.grade === 2).length;
  const partly = scored.filter((l) => l.grade === 1).length;
  const groups = [
    { title: "What it asks for", lines: scored.filter((l) => l.section !== "duty") },
    { title: "What you'd do", lines: scored.filter((l) => l.section === "duty") },
  ].filter((g) => g.lines.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone">
        {scored.length > 0
          ? `${met} met, ${partly} partly, of ${scored.length} scored lines · checked against your resume`
          : "Nothing on this posting is something a resume can show, so skills score a typical 28 of 70."}
        {detail.updating && " · updating for your latest skill changes…"}
      </p>

      {groups.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <h5 className="text-[11.5px] font-medium uppercase tracking-wide text-steel">{group.title}</h5>
          <ul className="divide-y divide-hairline-soft">
            {group.lines.map((line) => (
              <LineRow key={line.lineNo} line={line} />
            ))}
          </ul>
        </div>
      ))}

      {unscored.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setShowUnscored((v) => !v)}
            className="text-xs text-steel hover:text-charcoal"
            aria-expanded={showUnscored}
          >
            {showUnscored ? "Hide" : "Show"} {unscored.length} line{unscored.length === 1 ? "" : "s"} that aren&apos;t scored
          </button>
          {showUnscored && (
            <ul className="divide-y divide-hairline-soft">
              {unscored.map((line) => (
                <li key={line.lineNo} className="py-2 text-[12.5px] text-steel">
                  <span className="block">{line.text}</span>
                  <span className="text-[11.5px] text-stone">{UNSCORED_REASON[line.kind] ?? "Not scored"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function LineRow({ line }: { line: CheckedLine }) {
  const chip = line.grade == null ? null : GRADE_CHIP[line.grade];
  const tags = [
    line.importance === "preferred" ? "Nice to have" : null,
    line.kind === "trait" ? "Soft skill" : null,
  ].filter(Boolean);

  return (
    <li className="py-2.5 grid grid-cols-[76px_1fr] gap-3 items-start">
      <span
        className={`justify-self-start text-[11.5px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
          chip?.className ?? "bg-hairline-soft text-steel"
        }`}
      >
        {chip?.label ?? "Waiting"}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-[13px] text-charcoal leading-snug">
          {line.text}
          {tags.map((t) => (
            <span key={t} className="ml-1.5 text-[11px] text-stone whitespace-nowrap">
              · {t}
            </span>
          ))}
        </p>
        {line.evidence && (
          <p className="text-[12px] text-steel leading-snug line-clamp-2" title={line.evidence}>
            <span className="text-stone">Your resume: </span>
            {line.evidence}
          </p>
        )}
      </div>
    </li>
  );
}

async function fetchDetail(jobId: string, method: "GET" | "POST", signal?: AbortSignal): Promise<CheckDetail> {
  const res = await fetch(`/api/match/${jobId}`, { method, signal });
  const json = await res.json();
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `The server answered ${res.status}.`);
  return json.data as CheckDetail;
}
