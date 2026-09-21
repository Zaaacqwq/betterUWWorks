import type { JobDetail, JobSummary, WorkTermRatings } from "@/components/types/job";
import type { PayInfo, Requirement } from "@/lib/job-details/types";
import { listedDetails } from "@/lib/job-details/listed";
import type { CheckDetail, CheckedLine } from "@/lib/line-check/detail";
import { lineWeight, scoreLines } from "@/lib/line-check/score";
import type { Grade, LineGrade, LineImportance, LineKind, LineSection, ResumeSection } from "@/lib/line-check/types";
import type { DetailedMatch } from "@/lib/resume/types";

// A demo posting written out short, and the three shapes the pages ask for it
// in: the row in the list, the whole posting, and its line-by-line check. The
// check is scored by lib/line-check's own scorer, so the demo's numbers are
// worked out the same way a real posting's are.

export interface SampleLine {
  section: LineSection;
  kind: LineKind;
  importance?: LineImportance;
  text: string;
  // Left out where the line is one no resume could answer (a heading, "you
  // will gain", an eligibility rule shown as a warning instead).
  grade?: Grade;
  // The resume line the grade rests on, and where on the resume it sits.
  evidence?: string;
  from?: ResumeSection;
}

export interface SamplePosting {
  jobId: string;
  title: string;
  organization: string;
  division?: string;
  location: string;
  address?: string;
  arrangement: "On-site" | "Hybrid" | "Remote";
  workTerm: string;
  duration: string;
  level?: string;
  jobType?: string;
  openings: number;
  // Days from today, so the demo never goes stale.
  closesInDays: number;
  pay?: { min: number; max?: number; hours?: number; quote: string };
  rating?: { score: number; count: number };
  totalHires?: number;
  hiresByTerm?: Record<string, number>;
  summary: string;
  skills: string[];
  requirements?: Requirement[];
  employerSummary: string;
  responsibilities: string;
  requiredSkills: string;
  compensation?: string;
  application?: string;
  ratings?: WorkTermRatings;
  // Left out where the posting hasn't been checked line by line yet: its score
  // then shows as an estimate, exactly as a freshly imported posting does.
  lines?: SampleLine[];
  letter: string;
  advice: DetailedMatch;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deadlineAt(closesInDays: number, now = new Date()): string {
  const at = new Date(now.getTime() + closesInDays * DAY_MS);
  at.setHours(23, 59, 0, 0);
  return at.toISOString();
}

function payInfo(sample: SamplePosting): PayInfo | null {
  if (!sample.pay) return null;
  const { min, max, hours, quote } = sample.pay;
  return {
    stated: true,
    currency: "CAD",
    currencySource: "location",
    period: "hour",
    periodSource: "stated",
    min,
    max: max ?? min,
    byTerm: [],
    hoursPerWeek: hours ?? 40,
    quote,
    hourlyCad: { min, max: max ?? min },
  };
}

export function toDetail(sample: SamplePosting, now = new Date()): JobDetail {
  const details = { pay: payInfo(sample), requirements: sample.requirements ?? [] };
  const pay = details.pay;
  return {
    jobId: sample.jobId,
    title: sample.title,
    organization: sample.organization,
    division: sample.division ?? null,
    location: sample.location,
    level: sample.level ?? null,
    deadline: null,
    deadlineAt: deadlineAt(sample.closesInDays, now),
    openings: sample.openings,
    workTerm: sample.workTerm,
    jobType: sample.jobType ?? "Co-op",
    region: sample.location.split(",").pop()?.trim() ?? null,
    address: sample.address ?? null,
    locationArrangement: sample.arrangement,
    workTermDuration: sample.duration,
    specialRequirements: null,
    jobSummary: sample.employerSummary,
    jobResponsibilities: sample.responsibilities,
    requiredSkills: sample.requiredSkills,
    compensation: sample.compensation ?? null,
    applicationDelivery: null,
    applicationInfo: sample.application ?? null,
    parsedHourlyMin: pay?.hourlyCad?.min ?? null,
    parsedHourlyMax: pay?.hourlyCad?.max ?? null,
    employerRating: sample.rating?.score ?? null,
    employerRatingCount: sample.rating?.count ?? null,
    totalHires: sample.totalHires ?? null,
    serviceTeam: null,
    rawDetail: null,
    workTermRatings: sample.ratings ?? null,
    aiSummary: sample.summary,
    aiSkills: sample.skills,
    aiDetails: details,
    aiSkillsAt: "2026-09-01T09:00:00.000Z",
    aiDetailsAt: "2026-09-01T09:00:00.000Z",
  };
}

export function toSummary(sample: SamplePosting, now = new Date()): JobSummary {
  const detail = toDetail(sample, now);
  return {
    jobId: detail.jobId,
    title: detail.title,
    organization: detail.organization,
    division: detail.division,
    location: detail.location,
    level: detail.level,
    deadline: detail.deadline,
    deadlineAt: detail.deadlineAt,
    openings: detail.openings,
    jobType: detail.jobType,
    workTerm: detail.workTerm,
    locationArrangement: detail.locationArrangement,
    workTermDuration: detail.workTermDuration,
    parsedHourlyMin: detail.parsedHourlyMin,
    parsedHourlyMax: detail.parsedHourlyMax,
    employerRating: detail.employerRating,
    employerRatingCount: detail.employerRatingCount,
    totalHires: detail.totalHires,
    aiSkills: detail.aiSkills,
    aiDetails: listedDetails(detail.aiDetails),
    hiresByWorkTermNumber: sample.hiresByTerm ?? null,
  };
}

function checkedLines(lines: SampleLine[]): CheckedLine[] {
  return lines.map((line, i) => {
    const tags = { section: line.section, kind: line.kind, importance: line.importance ?? "required" };
    return {
      lineNo: i + 1,
      section: tags.section,
      text: line.text,
      kind: tags.kind,
      importance: tags.importance,
      weight: lineWeight(tags),
      grade: line.grade ?? null,
      evidence: line.evidence ?? null,
      evidenceSection: line.evidence ? (line.from ?? "other") : null,
    };
  });
}

/** The posting's check as the Match breakdown reads it, or nothing if it hasn't been checked. */
export function toCheck(sample: SamplePosting): CheckDetail {
  if (!sample.lines) return { status: "unavailable" };
  const lines = checkedLines(sample.lines);
  const score = skillsScore(sample.lines);
  return { status: "checked", ...score, updating: false, lines };
}

/** The posting's skills score out of 70, from lib/line-check's own scorer. */
export function skillsScore(lines: SampleLine[]) {
  const tags = lines.map((line, i) => ({
    lineNo: i + 1,
    section: line.section,
    kind: line.kind,
    importance: line.importance ?? "required",
  }));
  const grades: LineGrade[] = lines
    .map((line, i): LineGrade | null =>
      line.grade == null ? null : [i + 1, line.grade, line.evidence ? i + 1 : 0]
    )
    .filter((g): g is LineGrade => g !== null);
  const sections = new Map<number, ResumeSection>(
    lines.flatMap((line, i) => (line.evidence ? [[i + 1, line.from ?? "other"] as const] : []))
  );
  return scoreLines(tags, grades, sections);
}
