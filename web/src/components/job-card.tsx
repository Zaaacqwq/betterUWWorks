"use client";

import type { MatchScore } from "@/lib/resume/types";
import type { JobSummary } from "./types/job";
import { deadlineInfo, formatPay, PAY_TIER_TEXT, payTier, ratingTone, shortDuration, TONE_TEXT } from "@/lib/format";
import { payDisplay } from "@/lib/job-details/present";
import { MatchRing } from "./match-ring";
import { BookmarkIcon, BuildingIcon, CalendarIcon, PeopleIcon, PinIcon, StarIcon } from "./icons";

type JobCardJob = Pick<
  JobSummary,
  | "jobId"
  | "title"
  | "organization"
  | "location"
  | "openings"
  | "locationArrangement"
  | "workTermDuration"
  | "parsedHourlyMin"
  | "parsedHourlyMax"
  | "employerRating"
  | "employerRatingCount"
  | "deadlineAt"
  | "aiDetails"
>;

interface JobCardProps {
  job: JobCardJob;
  active?: boolean;
  saved?: boolean;
  matchScore?: MatchScore;
  onClick: (jobId: string) => void;
}

// C$ an hour when the pay comes to that, so cards compare at a glance and
// can be coloured by tier; otherwise the posting's own figure, uncoloured.
function cardPay(job: JobCardJob): { text: string; className: string } | null {
  const hourly = formatPay(job.parsedHourlyMin, job.parsedHourlyMax);
  const tier = payTier(job.parsedHourlyMin, job.parsedHourlyMax);
  if (hourly && tier) return { text: `${hourly}/hr`, className: PAY_TIER_TEXT[tier] };
  const display = payDisplay(job.aiDetails?.pay ?? null);
  return display && display.text !== "Not stated" ? { text: display.text, className: "text-ink" } : null;
}

// Who and where above the line, the numbers below it: pay first and largest,
// the deadline opposite, then rating and openings — each in its own place so
// the eye finds it without reading the row.
export function JobCard({ job, active, saved, matchScore, onClick }: JobCardProps) {
  const pay = cardPay(job);
  const deadline = deadlineInfo(job.deadlineAt);
  const place = [job.location, job.locationArrangement, shortDuration(job.workTermDuration)].filter(Boolean).join(" · ");

  return (
    <button
      onClick={() => onClick(job.jobId)}
      aria-current={active ? "true" : undefined}
      className={`w-full text-left bg-canvas border rounded-[10px] px-3.5 py-3 transition-[border-color,box-shadow] cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 ${
        active ? "border-primary ring-[3px] ring-primary/12" : "border-hairline hover:border-hairline-strong"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="flex items-start gap-1.5 text-sm font-semibold text-ink leading-snug">
            {saved && (
              <span className="text-primary mt-0.5" title="Saved">
                <BookmarkIcon className="w-3.5 h-3.5" filled />
              </span>
            )}
            <span className="line-clamp-2">{job.title}</span>
          </h3>
          <p className="flex items-center gap-1.5 text-[12.5px] text-slate min-w-0">
            <BuildingIcon className="w-3.5 h-3.5 shrink-0 text-stone" />
            <span className="truncate">{job.organization}</span>
          </p>
          {place && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-slate min-w-0">
              <PinIcon className="w-3.5 h-3.5 shrink-0 text-stone" />
              <span className="truncate">{place}</span>
            </p>
          )}
        </div>
        {matchScore != null && <MatchRing score={matchScore.score} size={46} estimate={!matchScore.checked} />}
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-hairline-soft space-y-1.5 tabular-nums">
        <div className="flex items-baseline justify-between gap-3">
          {pay ? (
            <span className={`text-[14px] font-semibold whitespace-nowrap truncate ${pay.className}`}>{pay.text}</span>
          ) : (
            <span className="text-[13px] text-stone whitespace-nowrap">Pay not stated</span>
          )}
          {deadline && (
            <span
              className={`flex items-center gap-1 text-[12.5px] whitespace-nowrap ${deadline.closed ? "text-stone" : "text-slate"}`}
            >
              <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
              {deadline.closed ? "Closed" : `Closes ${deadline.date}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[12.5px] text-slate">
          {job.employerRating != null ? (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <StarIcon className={`w-3.5 h-3.5 ${TONE_TEXT[ratingTone(job.employerRating)]}`} />
              <span className="text-charcoal">{job.employerRating.toFixed(1)}</span>
              {job.employerRatingCount != null && <span className="text-stone">({job.employerRatingCount})</span>}
            </span>
          ) : (
            <span className="flex items-center gap-1 whitespace-nowrap text-stone">
              <StarIcon className="w-3.5 h-3.5" />
              No ratings yet
            </span>
          )}
          {job.openings != null && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <PeopleIcon className="w-3.5 h-3.5 shrink-0 text-stone" />
              {job.openings} {job.openings === 1 ? "opening" : "openings"}
            </span>
          )}
          {/* Under the closing date: how long is left, red within three days. */}
          {deadline && !deadline.closed && (
            <span className={`ml-auto whitespace-nowrap font-medium ${TONE_TEXT[deadline.tone]}`}>{deadline.away}</span>
          )}
        </div>
      </div>
    </button>
  );
}
