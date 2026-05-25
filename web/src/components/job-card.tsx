"use client";

import type { MatchScore } from "@/lib/resume/types";


interface JobCardProps {
  job: {
    jobId: string;
    title: string;
    organization: string;
    location: string | null;
    level: string | null;
    openings: number | null;
    workTerm: string | null;
    locationArrangement: string | null;
    workTermDuration: string | null;
    parsedHourlyMin: number | null;
    parsedHourlyMax: number | null;
    employerRating: number | null;
    employerRatingCount: number | null;
    totalHires: number | null;
  };
  active?: boolean;
  saved?: boolean;
  matchScore?: MatchScore;
  onClick: (jobId: string) => void;
}

export function JobCard({ job, active, saved, matchScore, onClick }: JobCardProps) {
  const payText = formatPay(job.parsedHourlyMin, job.parsedHourlyMax);

  return (
    <button
      onClick={() => onClick(job.jobId)}
      className={`w-full text-left bg-canvas border rounded-xl px-4 py-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer ${
        active
          ? "border-primary/50 shadow-sm ring-1 ring-primary/20"
          : "border-hairline"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {saved && (
              <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            )}
            <h3 className="text-sm font-semibold text-ink leading-snug truncate">
              {job.title}
            </h3>
          </div>
          <p className="text-xs text-slate mt-0.5 truncate">{job.organization}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {job.employerRating != null && (
            <RatingBadge rating={job.employerRating} />
          )}
          {payText && (
            <span className="text-[11px] font-bold text-brand-green bg-card-tint-mint px-2 py-0.5 rounded-full whitespace-nowrap">
              {payText}
            </span>
          )}
          {matchScore != null && <MatchBadge score={matchScore.score} />}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {job.location && <Tag color="lavender">{job.location}</Tag>}
        {job.locationArrangement && (
          <Tag color={job.locationArrangement === "Remote" ? "mint" : "default"}>
            {job.locationArrangement}
          </Tag>
        )}
        {job.level && <Tag color="default">{job.level}</Tag>}
        {job.workTerm && <Tag color="peach">{job.workTerm}</Tag>}
        {job.workTermDuration && <Tag color="default">{job.workTermDuration}</Tag>}
        {job.openings != null && job.openings > 1 && (
          <Tag color="mint">{job.openings} openings</Tag>
        )}
      </div>

      {matchScore != null && <ScoreBreakdown score={matchScore} />}
    </button>
  );
}

function ScoreBreakdown({ score }: { score: MatchScore }) {
  const { breakdown, warnings, debug } = score;

  return (
    <div className="mt-2 pt-2 border-t border-hairline-soft space-y-2">
      {/* Bar overview */}
      <div className="flex items-center gap-3">
        <ScoreBar label="Skills" value={breakdown.skills} max={70} />
        <ScoreBar label="Level" value={breakdown.level} max={15} />
        <ScoreBar label="Program" value={breakdown.program} max={15} />
      </div>

      {/* Skills detail */}
      {debug.skills.jobSkills.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] text-stone">
            <span className={`inline-block px-1 rounded text-[9px] font-bold mr-1 ${debug.skills.source === "ai" ? "bg-primary/10 text-primary" : "bg-surface text-slate"}`}>
              {debug.skills.source === "ai" ? "AI" : "regex"}
            </span>
            Skills overlap: {Math.round(debug.skills.overlap * 100)}% ({debug.skills.matched.length}/{debug.skills.jobSkills.length})
          </p>
          <div className="flex flex-wrap gap-0.5">
            {debug.skills.matched.map((m, i) => (
              <span
                key={`${m.skill}-${i}`}
                className="text-[10px] px-1.5 py-px rounded-full bg-brand-green/15 text-brand-green font-medium"
                style={{ opacity: 0.4 + m.weight * 0.6 }}
                title={`${m.evidenceType} · conf ${Math.round(m.confidence * 100)}% · weight ${Math.round(m.weight * 100)}%`}
              >
                {m.skill}
                {m.evidenceType === "inferred" || m.evidenceType === "weak_inferred" ? "~" : ""}
              </span>
            ))}
            {debug.skills.missing.map((s, i) => (
              <span key={`${s}-${i}`} className="text-[10px] px-1.5 py-px rounded-full bg-error/10 text-error font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {debug.skills.jobSkills.length === 0 && (
        <p className="text-[10px] text-stone italic">
          No skills detected ({debug.skills.source === "ai" ? "AI returned empty" : "regex fallback"}, 0/70)
        </p>
      )}

      {/* Level detail */}
      <p className="text-[10px] text-stone">
        {debug.level.historyMatch
          ? `Term ${debug.level.userCoopTerm} · ${debug.level.historyMatch}`
          : debug.level.jobLevel
            ? `Job: ${debug.level.jobLevel} · You: term ${debug.level.userCoopTerm}`
            : "No level or hiring history (neutral 8/15)"}
      </p>

      {/* Program detail */}
      <p className="text-[10px] text-stone">
        {!debug.program.userProgram
          ? "Program not set (neutral 8/15)"
          : !debug.program.jobMentionsProgram
            ? `Your program: ${debug.program.userProgram} · Job has no program requirement (10/15)`
            : debug.program.matched
              ? `Your program: ${debug.program.userProgram} · Matches job requirement (15/15)`
              : `Your program: ${debug.program.userProgram} · Does NOT match job requirement (3/15)`}
      </p>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {warnings.map((w, i) => (
            <span key={i} className="text-[10px] text-error bg-error/10 px-1.5 py-0.5 rounded-full">
              {w.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const barColor =
    pct >= 75
      ? "bg-brand-green"
      : pct >= 50
        ? "bg-brand-orange"
        : "bg-error/60";

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-stone">{label}</span>
        <span className="text-[10px] font-semibold text-slate">{value}/{max}</span>
      </div>
      <div className="h-1 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating >= 8.5
      ? "bg-brand-green/15 text-brand-green"
      : rating >= 7
        ? "bg-brand-orange/15 text-brand-orange"
        : "bg-error/15 text-error";

  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${color}`}>
      {rating.toFixed(1)}
    </span>
  );
}

function MatchBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-brand-green/15 text-brand-green"
      : score >= 60
        ? "bg-brand-orange/15 text-brand-orange"
        : "bg-surface text-slate";

  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${color}`}>
      {score}%
    </span>
  );
}

const TAG_COLORS = {
  lavender: "bg-card-tint-lavender text-primary-deep",
  mint: "bg-card-tint-mint text-charcoal",
  peach: "bg-card-tint-peach text-brand-orange-deep",
  default: "bg-surface text-slate",
} as const;

function Tag({ children, color = "default" }: { children: React.ReactNode; color?: keyof typeof TAG_COLORS }) {
  return (
    <span className={`inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-full ${TAG_COLORS[color]}`}>
      {children}
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
