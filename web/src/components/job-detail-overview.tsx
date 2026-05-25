"use client";

import type { JobDetail } from "./types/job";
import { AiSummary } from "./ai-summary";
import { MatchAnalysis } from "./match-analysis";

interface JobDetailOverviewProps {
  job: JobDetail;
}

const KNOWN_KEYS = new Set([
  "job title", "organization", "division", "level",
  "number of job openings", "work term", "job type",
  "region", "work term duration",
  "employment location arrangement", "location/work arrangement",
  "job summary", "job responsibilities", "required skills",
  "compensation and benefits", "compensation and benefits information",
  "special job requirements", "additional information",
  "application delivery", "additional application information",
  "application information", "service team",
  "job - address line one",
]);

const EXTRA_FIELD_LABELS: Record<string, string> = {
  "perks": "Perks",
  "targeted degrees and disciplines": "Targeted Degrees and Disciplines",
  "if by website, go to": "Application Website",
  "job - city": "City",
  "job - country": "Country",
  "job - province/state": "Province / State",
  "job - postal/zip code": "Postal / Zip Code",
};

export function JobDetailOverview({ job }: JobDetailOverviewProps) {
  const extraFields = getExtraFields(job.rawDetail);

  return (
    <div className="space-y-5">
      <AiSummary jobId={job.jobId} />
      <MatchAnalysis jobId={job.jobId} />

      <KeyFactsGrid job={job} />

      {job.jobSummary && (
        <TextSection title="Job Summary" content={job.jobSummary} />
      )}
      {job.jobResponsibilities && (
        <TextSection title="Responsibilities" content={job.jobResponsibilities} />
      )}
      {job.requiredSkills && (
        <TextSection title="Required Skills" content={job.requiredSkills} />
      )}
      {job.specialRequirements && (
        <TextSection title="Special Requirements" content={job.specialRequirements} />
      )}
      {job.compensation && (
        <TextSection title="Compensation and Benefits" content={job.compensation} />
      )}
      {job.applicationDelivery && (
        <TextSection title="Application Delivery" content={job.applicationDelivery} />
      )}
      {job.applicationInfo && (
        <TextSection title="Additional Application Info" content={job.applicationInfo} />
      )}
      {job.address && (
        <TextSection title="Address" content={job.address} />
      )}
      {job.serviceTeam && (
        <TextSection title="Service Team" content={job.serviceTeam} />
      )}

      {extraFields.map(({ label, value }) => (
        <TextSection key={label} title={label} content={value} />
      ))}
    </div>
  );
}

function getExtraFields(rawDetail: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!rawDetail) return [];

  const result: { label: string; value: string }[] = [];

  for (const [key, val] of Object.entries(rawDetail)) {
    if (key.startsWith("_")) continue;
    const lower = key.toLowerCase().trim();
    if (KNOWN_KEYS.has(lower)) continue;
    if (typeof val !== "string" || !val.trim()) continue;
    if (val.trim().toLowerCase() === "view targeted degrees and disciplines") continue;

    const label = EXTRA_FIELD_LABELS[lower] ?? key;
    result.push({ label, value: val.trim() });
  }

  return result;
}

function KeyFactsGrid({ job }: { job: JobDetail }) {
  const deadline = job.deadline;
  const deadlineColor = getDeadlineColor(deadline);

  const facts: { label: string; value: string; color?: string }[] = [];

  if (job.location) facts.push({ label: "Location", value: job.location });
  if (job.locationArrangement) facts.push({ label: "Work Mode", value: job.locationArrangement });
  if (job.level) facts.push({ label: "Level", value: job.level });
  if (job.workTerm) facts.push({ label: "Work Term", value: job.workTerm });
  if (job.workTermDuration) facts.push({ label: "Duration", value: job.workTermDuration });
  if (job.jobType) facts.push({ label: "Job Type", value: job.jobType });
  if (job.openings != null) facts.push({ label: "Openings", value: String(job.openings) });
  if (job.totalHires != null && job.totalHires > 0) {
    facts.push({ label: "Total Hires", value: `${job.totalHires} (past 9 terms)` });
  }
  if (deadline) facts.push({ label: "Deadline", value: deadline, color: deadlineColor });
  if (job.region) facts.push({ label: "Region", value: job.region });

  if (facts.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {facts.map((fact) => (
        <div key={fact.label} className="bg-surface-soft border border-hairline-soft rounded-lg px-3.5 py-2.5">
          <p className="text-[11px] text-stone font-medium uppercase tracking-wider">{fact.label}</p>
          <p className={`text-sm font-medium mt-0.5 ${fact.color ?? "text-charcoal"}`}>{fact.value}</p>
        </div>
      ))}
    </div>
  );
}

function TextSection({ title, content }: { title: string; content: string }) {
  if (isUrl(content)) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-stone uppercase tracking-wider mb-2">{title}</h4>
        <a
          href={content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-link-blue hover:underline break-all"
        >
          {content}
        </a>
      </div>
    );
  }

  const lines = parseBulletPoints(content);

  return (
    <div>
      <h4 className="text-xs font-semibold text-stone uppercase tracking-wider mb-2">{title}</h4>
      {lines.length > 1 ? (
        <ul className="space-y-1 ml-4">
          {lines.map((line, i) => (
            <li key={i} className="text-sm text-charcoal leading-relaxed list-disc">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-charcoal leading-relaxed whitespace-pre-line">{content}</p>
      )}
    </div>
  );
}

function parseBulletPoints(text: string): string[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/^[\s]*[-•*]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length <= 1) return [text.trim()];
  return lines;
}

function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/.test(trimmed);
}

function getDeadlineColor(deadline: string | null): string {
  if (!deadline) return "text-charcoal";
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return "text-charcoal";
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "text-stone";
    if (diffDays <= 2) return "text-error";
    if (diffDays <= 7) return "text-brand-orange";
    return "text-charcoal";
  } catch {
    return "text-charcoal";
  }
}
