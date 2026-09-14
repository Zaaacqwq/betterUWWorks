"use client";

import { useEffect, useState } from "react";
import { useResume } from "@/hooks/use-resume";
import { formatAmount, payDisplay, rateForTerm, requirementChips, type RequirementChip } from "@/lib/job-details/present";
import type { PayInfo } from "@/lib/job-details/types";
import type { JobDetail } from "./types/job";
import { SparklesIcon } from "./icons";
import { SkillPick } from "./skill-pick";

// The posting at a glance: what the work is, pay, what it requires and the
// skills it names — each read out of the posting and checked against it, so
// it opens with the job rather than behind a button.

const SKILLS_SHOWN = 14;

export function PostingGlance({ job }: { job: JobDetail }) {
  const summary = useSummary(job);
  const details = job.aiDetails;
  const chips = requirementChips(details?.requirements ?? []);
  const skills = job.aiSkills ?? [];
  const readYet = job.aiDetails !== null || job.aiSkills !== null;

  if (!readYet && summary.state === "none") return null;

  return (
    <section data-tour="glance" className="rounded-[10px] bg-surface px-4 py-3.5 space-y-3.5">
      <Summary state={summary} />
      {details?.pay && <PayRow pay={details.pay} />}
      {chips.length > 0 && (
        <Row label="Requirements">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <RequirementTag key={chip.kind} chip={chip} />
            ))}
          </div>
        </Row>
      )}
      {skills.length > 0 && <SkillsRow skills={skills} />}
      {!readYet && <p className="text-[12.5px] text-stone">Skills, pay and requirements are still being read from this posting.</p>}
    </section>
  );
}

type SummaryState =
  | { state: "loading" }
  | { state: "ready"; text: string }
  | { state: "none" };

// Imports write the summary in the background; a posting opened before that
// got to it asks for one on the spot.
function useSummary(job: JobDetail): SummaryState {
  const [fetched, setFetched] = useState<{ jobId: string; result: SummaryState } | null>(null);
  const needsFetch = job.aiSummary === null;

  useEffect(() => {
    if (!needsFetch) return;
    const controller = new AbortController();
    fetch(`/api/jobs/${job.jobId}/summary`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        const text = data.success ? data.data.summary : null;
        setFetched({ jobId: job.jobId, result: text ? { state: "ready", text } : { state: "none" } });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setFetched({ jobId: job.jobId, result: { state: "none" } });
      });
    return () => controller.abort();
  }, [job.jobId, needsFetch]);

  if (!needsFetch) return job.aiSummary ? { state: "ready", text: job.aiSummary } : { state: "none" };
  return fetched?.jobId === job.jobId ? fetched.result : { state: "loading" };
}

function Summary({ state }: { state: SummaryState }) {
  if (state.state === "none") return null;
  return (
    <div aria-live="polite">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-primary-deep mb-1">
        <SparklesIcon className="w-3.5 h-3.5 text-primary" />
        What you&apos;d do
      </p>
      {state.state === "loading" ? (
        <div className="space-y-1.5 py-0.5" aria-busy="true">
          <div className="h-3 bg-hairline rounded w-11/12 animate-pulse" />
          <div className="h-3 bg-hairline rounded w-2/3 animate-pulse" />
        </div>
      ) : (
        <p className="text-[14px] text-ink leading-relaxed max-w-[72ch]">{state.text}</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[104px_1fr] gap-1 sm:gap-3">
      <p className="text-[12.5px] text-steel sm:pt-0.5">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function PayRow({ pay }: { pay: PayInfo }) {
  const { userInfo } = useResume();
  const display = payDisplay(pay);
  if (!display) return null;
  const yours = rateForTerm(pay.byTerm, userInfo?.coopTermNumber);

  return (
    <Row label="Pay">
      <p className="text-[13.5px] text-ink" title={pay.quote}>
        <span className={pay.stated ? "font-semibold" : "text-slate"}>{display.text}</span>
        {display.hourlyCad && <span className="text-steel ml-1.5">{display.hourlyCad}</span>}
        {(display.periodInferred || display.currencyAssumed) && (
          <span className="text-xs text-stone ml-1.5">
            {display.periodInferred && display.currencyAssumed
              ? "(period and currency not stated)"
              : display.periodInferred
                ? "(period not stated)"
                : `(currency not stated; ${pay.currency} assumed)`}
          </span>
        )}
      </p>
      {pay.byTerm.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {pay.byTerm.map((rate) => {
            const isYours = rate.term === yours?.term;
            return (
              <span
                key={rate.term}
                className={`text-xs px-2 py-0.5 rounded-md border tabular-nums ${
                  isYours ? "border-primary-line bg-primary-tint text-primary-deep font-semibold" : "border-hairline bg-canvas text-charcoal"
                }`}
              >
                Term {rate.term}: {formatAmount(rate.amount, pay.currency)}
                {isYours && " · you"}
              </span>
            );
          })}
        </div>
      )}
    </Row>
  );
}

function RequirementTag({ chip }: { chip: RequirementChip }) {
  const tone = !chip.required
    ? "border-dashed border-hairline-strong text-slate bg-canvas"
    : chip.eligibility
      ? "border-fair/30 bg-fair/10 text-fair"
      : "border-hairline bg-canvas text-charcoal";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${tone}`} title={chip.quote}>
      {chip.label}
      {!chip.required && !/prefer|asset/i.test(chip.label) && <span className="font-normal text-stone"> · preferred</span>}
    </span>
  );
}

function SkillsRow({ skills }: { skills: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? skills : skills.slice(0, SKILLS_SHOWN);
  const hidden = skills.length - shown.length;

  return (
    <Row label="Skills">
      <div data-tour="glance-skills" className="flex flex-wrap gap-1.5">
        {shown.map((skill) => (
          <SkillPick key={skill} name={skill} className="text-xs px-2 py-0.5 rounded-md border border-hairline bg-canvas text-charcoal" />
        ))}
        {hidden > 0 && (
          <button onClick={() => setExpanded(true)} className="text-xs px-1.5 py-0.5 text-steel hover:text-ink transition-colors">
            +{hidden} more
          </button>
        )}
      </div>
    </Row>
  );
}
