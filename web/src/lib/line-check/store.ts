import { createHash } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobLines, jobs, lineGrades, resumes, type StoredResume } from "@/db/schema";
import { adminEmails } from "@/lib/auth/viewer";
import { torontoDay } from "@/lib/ai/quota";
import type { SkillLevel } from "@/lib/resume/types";
import { buildResumeLines, skillLines, updateSkillLines } from "./resume-lines";
import type { LineGrade, ResumeLine, TaggedLine } from "./types";

// Where students' resumes and their checks are kept.

// New resume versions a friend can have checked in a day; each is ~2M tokens
// across every open posting. Later uploads today are kept, and checked tomorrow.
export const DAILY_FULL_CHECKS = 2;

export interface ResumeInput {
  text: string;
  fileName: string | null;
  profile: unknown;
  userInfo: unknown;
  extraSkills: string[];
  skillLevels: Record<string, SkillLevel>;
}

export type ResumeChange =
  | { kind: "new-version" }
  | { kind: "skills"; added: ResumeLine[]; removed: ResumeLine[] }
  | { kind: "none" };

const hashText = (text: string) => createHash("sha256").update(text).digest("hex");

export async function getResume(email: string): Promise<StoredResume | null> {
  const [row] = await db.select().from(resumes).where(eq(resumes.email, email)).limit(1);
  return row ?? null;
}

export async function saveResume(
  email: string,
  input: ResumeInput,
  now = new Date()
): Promise<{ resume: StoredResume; change: ResumeChange }> {
  const existing = await getResume(email);
  const textHash = hashText(input.text);
  const wanted = skillLines(input.extraSkills, input.skillLevels);

  let version = existing?.version ?? 0;
  let lines: ResumeLine[];
  let fullChecks = existing?.fullChecks ?? {};
  let change: ResumeChange;

  if (!existing || existing.textHash !== textHash) {
    version += 1;
    lines = updateSkillLines(buildResumeLines(input.text), wanted).lines;
    const day = torontoDay(now);
    fullChecks = { day, count: fullChecks.day === day ? (fullChecks.count ?? 0) + 1 : 1 };
    change = { kind: "new-version" };
  } else {
    const update = updateSkillLines(existing.lines, wanted);
    lines = update.lines;
    change =
      update.added.length > 0 || update.removed.length > 0
        ? { kind: "skills", added: update.added, removed: update.removed }
        : { kind: "none" };
  }

  const values = {
    email,
    text: input.text,
    textHash,
    fileName: input.fileName,
    profile: input.profile ?? null,
    userInfo: input.userInfo ?? null,
    extraSkills: input.extraSkills,
    skillLevels: input.skillLevels,
    version,
    lines,
    fullChecks,
    updatedAt: now,
  };
  const [resume] = await db
    .insert(resumes)
    .values(values)
    .onConflictDoUpdate({ target: resumes.email, set: values })
    .returning();
  return { resume, change };
}

export async function deleteResume(email: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(lineGrades).where(eq(lineGrades.email, email));
    await tx.delete(resumes).where(eq(resumes.email, email));
  });
}

/** Past today's allowance of new versions: this version waits for tomorrow. */
export function isPaused(resume: Pick<StoredResume, "email" | "fullChecks">, now = new Date()): boolean {
  if (adminEmails().has(resume.email)) return false;
  const { day, count = 0 } = resume.fullChecks;
  return day === torontoDay(now) && count > DAILY_FULL_CHECKS;
}

export async function resumeOwners(): Promise<string[]> {
  const rows = await db.select({ email: resumes.email }).from(resumes);
  return rows.map((r) => r.email);
}

// Postings students are checked against: tagged, and still taking applications.
const OPEN = or(isNull(jobs.deadlineAt), gt(jobs.deadlineAt, sql`now()`));
const CHECKABLE = and(isNotNull(jobs.linesAt), OPEN);

// A stored check still describes the posting and the resume.
const currentFor = (version: number) =>
  and(eq(lineGrades.resumeVersion, version), eq(lineGrades.linesAt, jobs.linesAt));

export interface PendingPosting {
  jobId: string;
  level: string | null;
  aiSkills: string[] | null;
  deadlineAt: Date | null;
}

/** Open postings whose check for this resume is missing, out of date, or has lines to redo. */
export async function pendingPostings(email: string, version: number): Promise<PendingPosting[]> {
  return db
    .select({ jobId: jobs.jobId, level: jobs.level, aiSkills: jobs.aiSkills, deadlineAt: jobs.deadlineAt })
    .from(jobs)
    .leftJoin(lineGrades, and(eq(lineGrades.jobId, jobs.jobId), eq(lineGrades.email, email)))
    .where(
      and(
        CHECKABLE,
        or(
          isNull(lineGrades.jobId),
          ne(lineGrades.resumeVersion, version),
          ne(lineGrades.linesAt, jobs.linesAt),
          sql`jsonb_array_length(${lineGrades.staleLines}) > 0`
        )
      )
    );
}

export interface CheckProgress {
  total: number;
  checked: number;
}

export async function checkProgress(email: string, version: number): Promise<CheckProgress> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      checked: sql<number>`count(${lineGrades.jobId})::int`,
    })
    .from(jobs)
    .leftJoin(lineGrades, and(eq(lineGrades.jobId, jobs.jobId), eq(lineGrades.email, email), currentFor(version)))
    .where(CHECKABLE);
  return row;
}

/** Skills score, out of 70, of every posting checked against this resume version. */
export async function checkedScores(email: string, version: number): Promise<Record<string, number>> {
  const rows = await db
    .select({ jobId: lineGrades.jobId, skills: lineGrades.skills })
    .from(lineGrades)
    .innerJoin(jobs, eq(jobs.jobId, lineGrades.jobId))
    .where(and(eq(lineGrades.email, email), currentFor(version)));
  return Object.fromEntries(rows.map((r) => [r.jobId, r.skills]));
}

export interface PostingForCheck {
  jobId: string;
  title: string;
  linesAt: Date | null;
  lines: TaggedLine[];
}

export async function postingsForCheck(jobIds: string[]): Promise<PostingForCheck[]> {
  if (jobIds.length === 0) return [];
  const [heads, lines] = await Promise.all([
    db.select({ jobId: jobs.jobId, title: jobs.title, linesAt: jobs.linesAt }).from(jobs).where(inArray(jobs.jobId, jobIds)),
    db
      .select({
        jobId: jobLines.jobId,
        lineNo: jobLines.lineNo,
        section: jobLines.section,
        text: jobLines.text,
        kind: jobLines.kind,
        importance: jobLines.importance,
      })
      .from(jobLines)
      .where(inArray(jobLines.jobId, jobIds))
      .orderBy(jobLines.jobId, jobLines.lineNo),
  ]);
  return heads.map((h) => ({ ...h, lines: lines.filter((l) => l.jobId === h.jobId) }));
}

export interface StoredCheck {
  jobId: string;
  resumeVersion: number;
  linesAt: Date;
  grades: LineGrade[];
  skills: number;
  staleLines: number[];
}

export async function storedChecks(email: string, jobIds: string[]): Promise<Map<string, StoredCheck>> {
  if (jobIds.length === 0) return new Map();
  const rows = await db
    .select({
      jobId: lineGrades.jobId,
      resumeVersion: lineGrades.resumeVersion,
      linesAt: lineGrades.linesAt,
      grades: lineGrades.grades,
      skills: lineGrades.skills,
      staleLines: lineGrades.staleLines,
    })
    .from(lineGrades)
    .where(and(eq(lineGrades.email, email), inArray(lineGrades.jobId, jobIds)));
  return new Map(rows.map((r) => [r.jobId, r]));
}

export async function writeCheck(
  email: string,
  check: { jobId: string; resumeVersion: number; linesAt: Date; grades: LineGrade[]; skills: number }
): Promise<void> {
  const values = { email, ...check, staleLines: [] as number[], gradedAt: new Date() };
  await db
    .insert(lineGrades)
    .values(values)
    .onConflictDoUpdate({ target: [lineGrades.email, lineGrades.jobId], set: values });
}

/** Asks for some lines of already-checked postings to be checked again. */
export async function markStale(email: string, version: number, byJob: Map<string, number[]>): Promise<number> {
  let marked = 0;
  for (const [jobId, lineNos] of byJob) {
    if (lineNos.length === 0) continue;
    const rows = await db
      .update(lineGrades)
      .set({
        staleLines: sql`(select coalesce(jsonb_agg(distinct x order by x), '[]'::jsonb) from jsonb_array_elements(${lineGrades.staleLines} || ${JSON.stringify(lineNos)}::jsonb) as t(x))`,
      })
      .where(and(eq(lineGrades.email, email), eq(lineGrades.jobId, jobId), eq(lineGrades.resumeVersion, version)))
      .returning({ jobId: lineGrades.jobId });
    marked += rows.length;
  }
  return marked;
}

/** Every current check of this resume, for finding which cite a given line. */
export async function currentChecks(email: string, version: number): Promise<StoredCheck[]> {
  return db
    .select({
      jobId: lineGrades.jobId,
      resumeVersion: lineGrades.resumeVersion,
      linesAt: lineGrades.linesAt,
      grades: lineGrades.grades,
      skills: lineGrades.skills,
      staleLines: lineGrades.staleLines,
    })
    .from(lineGrades)
    .where(and(eq(lineGrades.email, email), eq(lineGrades.resumeVersion, version)));
}
