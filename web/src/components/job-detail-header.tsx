"use client";

import { useCallback, useState } from "react";
import type { MatchScore } from "@/lib/resume/types";
import type { JobDetail } from "./types/job";
import { deadlineInfo, formatPay, matchTone, PAY_TIER_TEXT, payTier, TONE_TEXT } from "@/lib/format";
import { payDisplay } from "@/lib/job-details/present";
import { postingUrl } from "@/lib/waterlooworks";
import { BookmarkIcon, CloseIcon, CopyIcon, ExternalIcon } from "./icons";

interface JobDetailHeaderProps {
  job: JobDetail;
  saved: boolean;
  matchScore?: MatchScore;
  onToggleSave: (jobId: string) => void;
  onClose: () => void;
}

export function JobDetailHeader({ job, saved, matchScore, onToggleSave, onClose }: JobDetailHeaderProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleCopyId = useCallback(() => {
    navigator.clipboard
      .writeText(job.jobId)
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("failed"))
      .finally(() => setTimeout(() => setCopyState("idle"), 1500));
  }, [job.jobId]);

  return (
    <div className="px-5 sm:px-7 pt-5 sm:pt-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-[21px] font-semibold text-ink leading-tight tracking-tight text-balance">
            {job.title}
          </h2>
          <p className="text-[13.5px] text-slate mt-1">
            {job.organization}
            {job.division ? ` — ${job.division}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            data-tour="save"
            onClick={() => onToggleSave(job.jobId)}
            aria-pressed={saved}
            className={`h-8 px-3 flex items-center gap-1.5 rounded-lg border text-[12.5px] font-medium transition-colors ${
              saved
                ? "border-primary-line bg-primary-tint text-primary-deep hover:bg-primary-tint/70"
                : "border-hairline text-charcoal hover:bg-surface"
            }`}
          >
            <BookmarkIcon className="w-3.5 h-3.5" filled={saved} />
            {saved ? "Saved" : "Save"}
          </button>
          <button
            onClick={handleCopyId}
            className="hidden sm:flex h-8 px-3 items-center gap-1.5 rounded-lg border border-hairline text-xs font-mono text-charcoal hover:bg-surface transition-colors"
            title="Copy job ID"
          >
            <CopyIcon />
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : job.jobId}
          </button>
          {/* The extension opens the posting from this link. Copy the id too,
              so anyone without it can paste it into WaterlooWorks' search. */}
          <a
            data-tour="apply"
            href={postingUrl(job.jobId)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCopyId}
            className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-primary text-on-primary text-[12.5px] font-semibold hover:bg-primary-pressed transition-colors"
            title="Open this posting on WaterlooWorks (also copies the job ID)"
          >
            Apply
            <ExternalIcon />
          </a>
          <button
            onClick={onClose}
            className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg border border-hairline text-slate hover:text-ink hover:bg-surface transition-colors"
            aria-label="Close job"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <MetricStrip job={job} matchScore={matchScore} />
    </div>
  );
}

function MetricStrip({ job, matchScore }: { job: JobDetail; matchScore?: MatchScore }) {
  const deadline = deadlineInfo(job.deadlineAt);

  const cells: { key: string; label: string; value: React.ReactNode; note?: string; valueClass?: string }[] = [
    payCell(job),
    job.employerRating != null
      ? {
          key: "rating",
          label: "Employer rating",
          value: job.employerRating.toFixed(1),
          note: job.employerRatingCount != null ? `/10 · ${job.employerRatingCount} ratings` : "/10",
        }
      : { key: "rating", label: "Employer rating", value: "None yet", valueClass: "text-stone" },
  ];
  if (matchScore) {
    cells.push({
      key: "match",
      label: "Match",
      value: `${matchScore.checked ? "" : "~"}${matchScore.score}%`,
      note: matchScore.checked ? undefined : "estimate",
      valueClass: TONE_TEXT[matchTone(matchScore.score)],
    });
  }
  cells.push(
    deadline
      ? {
          key: "deadline",
          label: "Closes",
          value: deadline.date,
          note: deadline.closed ? "closed" : deadline.away.toLowerCase(),
          valueClass: TONE_TEXT[deadline.tone],
        }
      : { key: "deadline", label: "Closes", value: job.deadline ?? "Not listed", valueClass: "text-stone" }
  );

  return (
    <div
      data-tour="detail-metrics"
      className={`grid grid-cols-2 ${cells.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"} border border-hairline-soft rounded-[10px] bg-surface-soft overflow-hidden`}
    >
      {cells.map((c, i) => (
        <div
          key={c.key}
          className={`px-3.5 py-2.5 min-w-0 border-hairline-soft ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${
            i > 0 ? "sm:border-l" : ""
          }`}
        >
          <p className="text-[11.5px] text-steel">{c.label}</p>
          <p className="text-[15px] font-semibold text-ink tabular-nums truncate">
            <span className={c.valueClass}>{c.value}</span>
            {c.note && <span className="text-xs font-normal text-steel ml-1">{c.note}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

// C$ an hour where the posting's pay comes to that, so every posting reads the
// same; otherwise the posting's own figures, and failing those, why there are none.
function payCell(job: JobDetail): { key: string; label: string; value: React.ReactNode; note?: string; valueClass?: string } {
  const hourly = formatPay(job.parsedHourlyMin, job.parsedHourlyMax);
  const tier = payTier(job.parsedHourlyMin, job.parsedHourlyMax);
  if (hourly && tier) return { key: "pay", label: "Pay", value: hourly, note: "/hr", valueClass: PAY_TIER_TEXT[tier] };

  const display = payDisplay(job.aiDetails?.pay ?? null);
  if (display && display.text !== "Not stated") return { key: "pay", label: "Pay", value: display.text };
  const reason = display ? "Not stated" : job.aiDetails ? "Not listed" : "Reading…";
  return { key: "pay", label: "Pay", value: reason, valueClass: "text-stone" };
}
