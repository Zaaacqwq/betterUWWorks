import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import { computeMatchScore } from "@/lib/resume/match-engine";
import { migrateProfile } from "@/lib/resume/migrate-profile";
import type { ResumeProfile, UserInfo } from "@/lib/resume/types";
import type { StoredResume } from "@/db/schema";
import { LINE_GRADES_SYSTEM, lineGradesPrompt, mergeGrades, verifyGrades, type PostingToGrade } from "./grade";
import { DISOWNED_PREFIX, renderResume } from "./resume-lines";
import { isCheckable, scoreLines } from "./score";
import type { LineGrade } from "./types";
import {
  getResume,
  isPaused,
  pendingPostings,
  postingsForCheck,
  resumeOwners,
  storedChecks,
  writeCheck,
  type PendingPosting,
  type PostingForCheck,
} from "./store";

// Checks students' resumes against the open postings, in the background.
// Every student with a resume has a queue of postings still to check, best
// estimated match first; calls are shared out between them in turn, and a
// posting a student opens jumps every queue. One call checks a few postings
// against the whole resume.

const CONCURRENCY = Number(process.env.LINE_CHECK_CONCURRENCY ?? 12);
const POSTINGS_PER_CALL = 5;
// A call with too many lines is slow to come back and more often comes back
// with some left out; big postings go fewer to a call.
const LINES_PER_CALL = 90;
const CALL_TIMEOUT_MS = 150_000;
// A posting whose check just failed waits before it is tried again, so one
// that always fails can't hold a queue.
const FAILURE_REST_MS = 30 * 60 * 1000;
const WAIT_TIMEOUT_MS = 90_000;

type Key = `${string}|${string}`;
const keyOf = (email: string, jobId: string): Key => `${email}|${jobId}`;

const queues = new Map<string, string[]>();
const dirty = new Set<string>();
const inFlight = new Set<Key>();
const resting = new Map<Key, number>();
const urgent: { email: string; jobId: string }[] = [];
const waiters = new Map<Key, (() => void)[]>();
let owners: string[] | null = null;
let turn = 0;
let active = 0;
let pumping = false;
let pumpAgain = false;

/** Something changed for this student (or, with no email, for everyone): look again. */
export function kick(email?: string): void {
  if (email) {
    dirty.add(email);
    if (owners && !owners.includes(email)) owners = null;
  } else {
    owners = null;
    queues.clear();
  }
  void pump();
}

/** Forgets a student's queue, after their resume is deleted. */
export function forget(email: string): void {
  queues.delete(email);
  dirty.delete(email);
  owners = owners?.filter((o) => o !== email) ?? null;
}

/** Checks this posting now, ahead of everything else; resolves once it is done or failed. */
export function checkNow(email: string, jobId: string): Promise<void> {
  const key = keyOf(email, jobId);
  resting.delete(key);
  const done = new Promise<void>((resolve) => {
    const list = waiters.get(key) ?? [];
    list.push(resolve);
    waiters.set(key, list);
    setTimeout(resolve, WAIT_TIMEOUT_MS);
  });
  if (!inFlight.has(key)) urgent.push({ email, jobId });
  void pump();
  return done;
}

export interface GraderState {
  running: boolean;
  queued: number;
}

export function graderState(email: string): GraderState {
  const queued = (queues.get(email)?.length ?? 0) + urgent.filter((u) => u.email === email).length;
  const running = [...inFlight].some((k) => k.startsWith(`${email}|`));
  return { running: running || queued > 0, queued };
}

async function pump(): Promise<void> {
  if (pumping) {
    pumpAgain = true;
    return;
  }
  pumping = true;
  try {
    do {
      pumpAgain = false;
      while (active < CONCURRENCY) {
        const task = await nextTask();
        if (!task) break;
        active++;
        task.jobIds.forEach((id) => inFlight.add(keyOf(task.email, id)));
        void run(task).finally(() => {
          active--;
          task.jobIds.forEach((id) => {
            const key = keyOf(task.email, id);
            inFlight.delete(key);
            waiters.get(key)?.forEach((resolve) => resolve());
            waiters.delete(key);
          });
          void pump();
        });
      }
    } while (pumpAgain);
  } catch (err) {
    console.error("[line-check] scheduling failed:", err);
  } finally {
    pumping = false;
  }
}

interface Task {
  email: string;
  jobIds: string[];
}

async function nextTask(): Promise<Task | null> {
  while (urgent.length > 0) {
    const { email, jobId } = urgent.shift()!;
    if (!inFlight.has(keyOf(email, jobId))) return { email, jobIds: [jobId] };
  }

  owners ??= await resumeOwners();
  for (let tried = 0; tried < owners.length; tried++) {
    const email = owners[turn++ % owners.length];
    if (dirty.has(email) || !queues.has(email)) {
      dirty.delete(email);
      queues.set(email, await buildQueue(email));
    }
    const queue = queues.get(email)!;
    const jobIds: string[] = [];
    while (queue.length > 0 && jobIds.length < POSTINGS_PER_CALL) {
      const jobId = queue.shift()!;
      const key = keyOf(email, jobId);
      const rested = resting.get(key);
      if (inFlight.has(key) || (rested && Date.now() - rested < FAILURE_REST_MS)) continue;
      jobIds.push(jobId);
    }
    if (jobIds.length > 0) return { email, jobIds };
  }
  return null;
}

async function buildQueue(email: string): Promise<string[]> {
  const resume = await getResume(email);
  if (!resume || isPaused(resume)) return [];
  const pending = await pendingPostings(email, resume.version);
  return orderByEstimate(resume, pending);
}

// Best estimated match first, by the name-matching score the list shows until
// a posting is checked: the postings a student looks at first get checked first.
function orderByEstimate(resume: StoredResume, pending: PendingPosting[]): string[] {
  const profile = resume.profile ? (migrateProfile(resume.profile as Record<string, unknown>) as ResumeProfile) : null;
  const userInfo = (resume.userInfo ?? null) as UserInfo | null;
  const estimate = (p: PendingPosting) =>
    profile
      ? computeMatchScore(profile, userInfo, { level: p.level, aiSkills: p.aiSkills, aiDetails: null, hiresByWorkTermNumber: null }, resume.extraSkills, resume.skillLevels).score
      : 0;
  return pending
    .map((p) => ({ jobId: p.jobId, estimate: estimate(p), deadline: p.deadlineAt?.getTime() ?? Infinity }))
    .sort((a, b) => b.estimate - a.estimate || a.deadline - b.deadline)
    .map((p) => p.jobId);
}

// What one posting needs: all its checkable lines against a new resume or a
// retagged posting, or just the lines a skill change touched.
interface Plan {
  posting: PostingForCheck;
  lineNos: number[];
  // Stored checks the fresh ones go over; empty for a full check.
  base: LineGrade[];
}

async function run(task: Task): Promise<void> {
  const resume = await getResume(task.email);
  if (!resume) return;
  const [postings, stored] = await Promise.all([postingsForCheck(task.jobIds), storedChecks(task.email, task.jobIds)]);

  const plans: Plan[] = [];
  for (const posting of postings) {
    if (!posting.linesAt) continue;
    const checkable = posting.lines.filter(isCheckable).map((l) => l.lineNo);
    const prior = stored.get(posting.jobId);
    const upToDate =
      prior && prior.resumeVersion === resume.version && prior.linesAt.getTime() === posting.linesAt.getTime();
    const lineNos = upToDate ? prior.staleLines.filter((n) => checkable.includes(n)) : checkable;
    const base = upToDate ? prior.grades : [];
    if (lineNos.length === 0) {
      // Nothing to ask the model: a posting with nothing checkable scores the
      // typical rate, and stale lines no longer on it are simply cleared.
      await writeCheck(task.email, {
        jobId: posting.jobId,
        resumeVersion: resume.version,
        linesAt: posting.linesAt,
        grades: base,
        skills: scoreLines(posting.lines, base).skills,
      });
      continue;
    }
    plans.push({ posting, lineNos, base });
  }

  for (const batch of batchByLines(plans)) {
    await checkBatch(resume, batch);
  }
}

function batchByLines(plans: Plan[]): Plan[][] {
  const batches: Plan[][] = [];
  let current: Plan[] = [];
  let lines = 0;
  for (const plan of plans) {
    if (current.length > 0 && lines + plan.lineNos.length > LINES_PER_CALL) {
      batches.push(current);
      current = [];
      lines = 0;
    }
    current.push(plan);
    lines += plan.lineNos.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function checkBatch(resume: StoredResume, batch: Plan[]): Promise<void> {
  const toGrade: PostingToGrade[] = batch.map(({ posting, lineNos }) => ({
    jobId: posting.jobId,
    title: posting.title,
    lines: posting.lines.filter((l) => lineNos.includes(l.lineNo)),
  }));
  const citable = new Set(resume.lines.filter((l) => l.active && !l.text.startsWith(DISOWNED_PREFIX)).map((l) => l.n));
  const resumeText = renderResume(resume.lines);

  let remaining = toGrade;
  for (let attempt = 1; attempt <= 2 && remaining.length > 0; attempt++) {
    let answer: unknown;
    try {
      const { text } = await generateText({
        model: models.fast,
        providerOptions: FAST_OPTIONS,
        system: LINE_GRADES_SYSTEM,
        prompt: lineGradesPrompt(resumeText, remaining),
        maxOutputTokens: 12000,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
      answer = parseAiJson(text, `line check for ${resume.email}`);
    } catch (err) {
      if (!(err instanceof AiJsonError)) {
        console.error(`[line-check] call failed for ${remaining.map((p) => p.jobId).join(",")}:`, err);
        break;
      }
      continue;
    }
    const graded = verifyGrades(answer, remaining, citable);
    // The resume may have changed while the model was reading the old one.
    const latest = await getResume(resume.email);
    if (!latest || latest.version !== resume.version) return;
    for (const { jobId, grades } of graded) {
      const plan = batch.find((p) => p.posting.jobId === jobId)!;
      const merged = mergeGrades(plan.base, grades);
      await writeCheck(resume.email, {
        jobId,
        resumeVersion: resume.version,
        linesAt: plan.posting.linesAt!,
        grades: merged,
        skills: scoreLines(plan.posting.lines, merged).skills,
      });
    }
    const done = new Set(graded.map((g) => g.jobId));
    remaining = remaining.filter((p) => !done.has(p.jobId));
  }

  // What a batch still lacks after two tries is asked about one posting at a
  // time: a long batch is the likeliest to come back cut short or garbled.
  if (remaining.length > 0 && batch.length > 1) {
    for (const posting of remaining) {
      await checkBatch(resume, batch.filter((p) => p.posting.jobId === posting.jobId));
    }
    return;
  }
  for (const { jobId } of remaining) resting.set(keyOf(resume.email, jobId), Date.now());
  if (remaining.length > 0) {
    console.error(`[line-check] ${remaining.length} posting(s) left unchecked for now: ${remaining.map((p) => p.jobId).join(",")}`);
  }
}
