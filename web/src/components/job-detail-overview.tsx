"use client";

import type { JobDetail } from "./types/job";
import { PostingGlance } from "./posting-glance";
import { deadlineInfo } from "@/lib/format";

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
    <div className="space-y-6">
      <PostingGlance job={job} />

      <KeyFacts job={job} />

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

function KeyFacts({ job }: { job: JobDetail }) {
  const deadline = deadlineInfo(job.deadlineAt);
  const facts: { label: string; value: string; className?: string }[] = [];

  if (job.location) facts.push({ label: "Location", value: job.location });
  if (job.locationArrangement) facts.push({ label: "Work mode", value: job.locationArrangement });
  if (job.workTerm) facts.push({ label: "Work term", value: job.workTerm });
  if (job.workTermDuration) facts.push({ label: "Duration", value: job.workTermDuration });
  if (job.level) facts.push({ label: "Level", value: job.level });
  if (job.jobType) facts.push({ label: "Job type", value: job.jobType });
  if (job.openings != null) facts.push({ label: "Openings", value: String(job.openings) });
  if (job.totalHires != null && job.totalHires > 0) {
    facts.push({ label: "Total hires", value: `${job.totalHires} over the past 9 terms` });
  }
  if (job.deadline) {
    facts.push({
      label: "Deadline",
      value: job.deadline,
      className: deadline?.urgent ? "text-poor font-medium" : deadline?.closed ? "text-stone" : undefined,
    });
  }
  if (job.region) facts.push({ label: "Region", value: job.region });

  if (facts.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-7">
      {facts.map((fact) => (
        <div key={fact.label} className="grid grid-cols-[96px_1fr] gap-2.5 py-2 border-b border-hairline-soft">
          <dt className="text-[12.5px] text-steel">{fact.label}</dt>
          <dd className={`text-[13px] text-ink ${fact.className ?? ""}`}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TextSection({ title, content }: { title: string; content: string }) {
  if (isUrl(content)) {
    return (
      <div>
        <h4 className="text-[13.5px] font-semibold text-ink mb-1.5">{title}</h4>
        <a
          href={content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13.5px] text-link-blue hover:underline break-all"
        >
          {content}
        </a>
      </div>
    );
  }

  const lines = parseBulletPoints(content);

  return (
    <div>
      <h4 className="text-[13.5px] font-semibold text-ink mb-1.5">{title}</h4>
      {lines.length > 1 ? (
        <ul className="space-y-1 ml-4">
          {lines.map((line, i) => (
            <li key={i} className="text-[13.5px] text-charcoal leading-relaxed list-disc marker:text-stone">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-charcoal leading-relaxed whitespace-pre-line max-w-[72ch]">{content}</p>
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
