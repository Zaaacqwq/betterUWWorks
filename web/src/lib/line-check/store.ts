import { createHash } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobLines, jobs, lineGrades, resumes, type StoredResume } from "@/db/schema";
import { adminEmails } from "@/lib/auth/viewer";
import { aiLimits, torontoDay } from "@/lib/ai/quota";
import type { SkillLevel } from "@/lib/resume/types";
import { buildResumeLines, skillLines, updateSkillLines } from "./resume-lines";
import { MAX_RESUMES, type LineGrade, type ResumeLine, type TaggedLine } from "./types";

// Where students' resumes and their checks are kept. A student may keep a few
// resumes; one is in use, and only that one is scored and checked in the
// background. Each resume's checks are kept, so going back to one already
// checked shows its scores at once.

export interface ResumeInput {
  text: string;
  fileName: string | null;
  label?: string | null;
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

export async function activeResume(email: string): Promise<StoredResume | null> {
  const [row] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.email, email), eq(resumes.active, true)))
    .limit(1);
  return row ?? null;
}

export async function listResumes(email: string): Promise<StoredResume[]> {
  return db.select().from(resumes).where(eq(resumes.email, email)).orderBy(desc(resumes.updatedAt));
}

function contentOf(input: ResumeInput, now: Date) {
  return {
    text: input.text,
    textHash: hashText(input.text),
    fileName: input.fileName,
    profile: input.profile ?? null,
    userInfo: input.userInfo ?? null,
    extraSkills: input.extraSkills,
    skillLevels: input.skillLevels,
    updatedAt: now,
  };
}

/** Saves over the resume in use, or starts the student's first one. */
export async function saveResume(
  email: string,
  input: ResumeInput,
  now = new Date()
): Promise<{ resume: StoredResume; change: ResumeChange }> {
  const existing = await activeResume(email);
  if (!existing) return { resume: await addResume(email, input, now), change: { kind: "new-version" } };

  const content = contentOf(input, now);
  const wanted = skillLines(input.extraSkills, input.skillLevels);
  const newVersion = existing.textHash !== content.textHash;
  const update = newVersion
    ? { lines: updateSkillLines(buildResumeLines(input.text), wanted).lines, added: [], removed: [] }
    : updateSkillLines(existing.lines, wanted);

  const day = torontoDay(now);
  const [resume] = await db
    .update(resumes)
    .set({
      ...content,
      label: input.label ?? existing.label,
      version: newVersion ? existing.version + 1 : existing.version,
      lines: update.lines,
      fullChecks: newVersion
        ? { day, count: existing.fullChecks.day === day ? (existing.fullChecks.count ?? 0) + 1 : 1 }
        : existing.fullChecks,
    })
    .where(eq(resumes.id, existing.id))
    .returning();

  const change: ResumeChange = newVersion
    ? { kind: "new-version" }
    : update.added.length > 0 || update.removed.length > 0
      ? { kind: "skills", added: update.added, removed: update.removed }
      : { kind: "none" };
  return { resume, change };
}

export class TooManyResumes extends Error {}

/** Keeps another resume and puts it in use. */
export async function addResume(email: string, input: ResumeInput, now = new Date()): Promise<StoredResume> {
  const day = torontoDay(now);
  return db.transaction(async (tx) => {
    const held = await tx.select({ id: resumes.id }).from(resumes).where(eq(resumes.email, email));
    if (held.length >= MAX_RESUMES) throw new TooManyResumes(`${MAX_RESUMES} resumes is the most you can keep here.`);
    await tx.update(resumes).set({ active: false }).where(eq(resumes.email, email));
    const [row] = await tx
      .insert(resumes)
      .values({
        email,
        label: input.label ?? input.fileName ?? `Resume ${held.length + 1}`,
        active: true,
        ...contentOf(input, now),
        version: 1,
        lines: updateSkillLines(buildResumeLines(input.text), skillLines(input.extraSkills, input.skillLevels)).lines,
        fullChecks: { day, count: 1 },
      })
      .returning();
    return row;
  });
}

/** Puts one of the student's resumes in use, and answers with it. */
export async function useResume(email: string, id: string): Promise<StoredResume | null> {
  return db.transaction(async (tx) => {
    const [wanted] = await tx
      .select()
      .from(resumes)
      .where(and(eq(resumes.email, email), eq(resumes.id, id)))
      .limit(1);
    if (!wanted) return null;
    await tx.update(resumes).set({ active: false }).where(eq(resumes.email, email));
    const [row] = await tx.update(resumes).set({ active: true }).where(eq(resumes.id, id)).returning();
    return row;
  });
}

export async function renameResume(email: string, id: string, label: string): Promise<StoredResume | null> {
  const [row] = await db
    .update(resumes)
    .set({ label })
    .where(and(eq(resumes.email, email), eq(resumes.id, id)))
    .returning();
  return row ?? null;
}

/** Removes one resume and its checks; the most recent of the rest takes over. */
export async function deleteResume(email: string, id: string): Promise<StoredResume | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(resumes)
      .where(and(eq(resumes.email, email), eq(resumes.id, id)))
      .returning();
    if (rows.length === 0) return null;
    await tx.delete(lineGrades).where(eq(lineGrades.resumeId, id));
    if (!rows[0].active) return activeResume(email);
    const [next] = await tx
      .select({ id: resumes.id })
      .from(resumes)
      .where(eq(resumes.email, email))
      .orderBy(desc(resumes.updatedAt))
      .limit(1);
    if (!next) return null;
    const [row] = await tx.update(resumes).set({ active: true }).where(eq(resumes.id, next.id)).returning();
    return row;
  });
}

/** Everything of this student's: for "remove my resume", and for a removed account. */
export async function deleteAllResumes(email: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(lineGrades).where(eq(lineGrades.email, email));
    await tx.delete(resumes).where(eq(resumes.email, email));
  });
}

/**
 * Past today's allowance of new versions — counted across all of a student's
 * resumes, each one costing a pass over every open posting — so this one waits
 * for tomorrow.
 */
export async function isPaused(email: string, now = new Date()): Promise<boolean> {
  if (adminEmails().has(email)) return false;
  const day = torontoDay(now);
  const [rows, limits] = await Promise.all([
    db.select({ fullChecks: resumes.fullChecks }).from(resumes).where(eq(resumes.email, email)),
    aiLimits(),
  ]);
  const started = rows.reduce((n, r) => n + (r.fullChecks.day === day ? (r.fullChecks.count ?? 0) : 0), 0);
  return started > limits.fullChecks;
}

/** The resume each student has in use: what the background checking works through. */
export async function resumesInUse(): Promise<{ email: string; id: string }[]> {
  return db.select({ email: resumes.email, id: resumes.id }).from(resumes).where(eq(resumes.active, true));
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
export async function pendingPostings(resumeId: string, version: number): Promise<PendingPosting[]> {
  return db
    .select({ jobId: jobs.jobId, level: jobs.level, aiSkills: jobs.aiSkills, deadlineAt: jobs.deadlineAt })
    .from(jobs)
    .leftJoin(lineGrades, and(eq(lineGrades.jobId, jobs.jobId), eq(lineGrades.resumeId, resumeId)))
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

export async function checkProgress(resumeId: string, version: number): Promise<CheckProgress> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      checked: sql<number>`count(${lineGrades.jobId})::int`,
    })
    .from(jobs)
    .leftJoin(lineGrades, and(eq(lineGrades.jobId, jobs.jobId), eq(lineGrades.resumeId, resumeId), currentFor(version)))
    .where(CHECKABLE);
  return row;
}

/** Skills score, out of 70, of every posting checked against this resume version. */
export async function checkedScores(resumeId: string, version: number): Promise<Record<string, number>> {
  const rows = await db
    .select({ jobId: lineGrades.jobId, skills: lineGrades.skills })
    .from(lineGrades)
    .innerJoin(jobs, eq(jobs.jobId, lineGrades.jobId))
    .where(and(eq(lineGrades.resumeId, resumeId), currentFor(version)));
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

const CHECK_COLUMNS = {
  jobId: lineGrades.jobId,
  resumeVersion: lineGrades.resumeVersion,
  linesAt: lineGrades.linesAt,
  grades: lineGrades.grades,
  skills: lineGrades.skills,
  staleLines: lineGrades.staleLines,
};

export async function storedChecks(resumeId: string, jobIds: string[]): Promise<Map<string, StoredCheck>> {
  if (jobIds.length === 0) return new Map();
  const rows = await db
    .select(CHECK_COLUMNS)
    .from(lineGrades)
    .where(and(eq(lineGrades.resumeId, resumeId), inArray(lineGrades.jobId, jobIds)));
  return new Map(rows.map((r) => [r.jobId, r]));
}

export async function writeCheck(
  resume: { id: string; email: string },
  check: { jobId: string; resumeVersion: number; linesAt: Date; grades: LineGrade[]; skills: number }
): Promise<void> {
  const values = { resumeId: resume.id, email: resume.email, ...check, staleLines: [] as number[], gradedAt: new Date() };
  await db
    .insert(lineGrades)
    .values(values)
    .onConflictDoUpdate({ target: [lineGrades.resumeId, lineGrades.jobId], set: values });
}

/** Asks for some lines of already-checked postings to be checked again. */
export async function markStale(resumeId: string, version: number, byJob: Map<string, number[]>): Promise<number> {
  let marked = 0;
  for (const [jobId, lineNos] of byJob) {
    if (lineNos.length === 0) continue;
    const rows = await db
      .update(lineGrades)
      .set({
        staleLines: sql`(select coalesce(jsonb_agg(distinct x order by x), '[]'::jsonb) from jsonb_array_elements(${lineGrades.staleLines} || ${JSON.stringify(lineNos)}::jsonb) as t(x))`,
      })
      .where(and(eq(lineGrades.resumeId, resumeId), eq(lineGrades.jobId, jobId), eq(lineGrades.resumeVersion, version)))
      .returning({ jobId: lineGrades.jobId });
    marked += rows.length;
  }
  return marked;
}

/** Every current check of this resume, for finding which cite a given line. */
export async function currentChecks(resumeId: string, version: number): Promise<StoredCheck[]> {
  return db
    .select(CHECK_COLUMNS)
    .from(lineGrades)
    .where(and(eq(lineGrades.resumeId, resumeId), eq(lineGrades.resumeVersion, version)));
}
