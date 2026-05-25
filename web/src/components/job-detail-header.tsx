"use client";

import { useCallback, useState } from "react";
import type { JobDetail } from "./types/job";

interface JobDetailHeaderProps {
  job: JobDetail;
  saved: boolean;
  onToggleSave: (jobId: string) => void;
  onClose: () => void;
}

export function JobDetailHeader({ job, saved, onToggleSave, onClose }: JobDetailHeaderProps) {
  const payText = formatPay(job.parsedHourlyMin, job.parsedHourlyMax);
  const [copied, setCopied] = useState(false);

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(job.jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [job.jobId]);

  return (
    <div className="px-6 pt-5 pb-4 border-b border-hairline">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink leading-snug">{job.title}</h2>
          <p className="text-sm text-slate mt-0.5">
            {job.organization}
            {job.division ? ` — ${job.division}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleSave(job.jobId)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              saved
                ? "text-primary hover:bg-surface"
                : "text-stone hover:text-ink hover:bg-surface"
            }`}
            aria-label={saved ? "Unsave job" : "Save job"}
          >
            <svg className="w-5 h-5" fill={saved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface text-stone hover:text-ink transition-colors"
            aria-label="Close detail"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={handleCopyId}
          className="text-[11px] font-mono font-medium text-slate bg-surface px-2 py-0.5 rounded hover:bg-surface-soft transition-colors"
          title="Click to copy Job ID"
        >
          {copied ? "Copied!" : `ID: ${job.jobId}`}
        </button>
        {job.employerRating != null && (
          <RatingBadge rating={job.employerRating} count={job.employerRatingCount} />
        )}
        {payText && (
          <span className="text-xs font-bold text-brand-green bg-card-tint-mint px-2.5 py-1 rounded-full">
            {payText}
          </span>
        )}
      </div>
    </div>
  );
}

function RatingBadge({ rating, count }: { rating: number; count: number | null }) {
  const color =
    rating >= 8.5
      ? "bg-brand-green/15 text-brand-green"
      : rating >= 7
        ? "bg-brand-orange/15 text-brand-orange"
        : "bg-error/15 text-error";

  return (
    <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${color}`}>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      {rating.toFixed(1)}
      {count != null && <span className="font-normal opacity-70">({count})</span>}
    </span>
  );
}

function formatPay(min: number | null, max: number | null): string | null {
  if (min == null) return null;
  if (max != null && max !== min) {
    return `$${Math.round(min)}–$${Math.round(max)}/hr`;
  }
  return `$${Math.round(min)}/hr`;
}
