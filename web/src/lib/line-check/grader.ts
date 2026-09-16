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
  activeResume,
  isPaused,
  pendingPostings,
  postingsForCheck,
  resumesInUse,
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
const CALL_TIMEOUT_MS = 240_000;
// A posting whose check just failed waits before it is tried again, so one
// that always fails can't hold a queue. A call that timed out or errored says
// nothing about the posting, so that one comes back round quickly; one whose
// answer was unusable twice is likelier to fail again.
const FAILURE_REST_MS = 30 * 60 * 1000;
const RETRY_REST_MS = 60_000;
const WAIT_TIMEOUT_MS = 90_000;

type Key = `${string}|${string}`;
const keyOf = (email: string, jobId: string): Key => `${email}|${jobId}`;

// One scheduler per server process. Kept on globalThis because Next can load
// this module more than once — in the instrumentation hook that restarts it
// and in the routes that feed it — and two copies would check twice.
interface GraderState {
  queues: Map<string, string[]>;
  dirty: Set<string>;
  inFlight: Set<Key>;
  // Postings waiting to be tried again, and the moment each may be.
  resting: Map<Key, number>;
  urgent: { email: string; jobId: string }[];
  waiters: Map<Key, (() => void)[]>;
  owners: string[] | null;
  turn: number;
  active: number;
  pumping: boolean;
  pumpAgain: boolean;
}

const S: GraderState = ((globalThis as { __buwLineGrader?: GraderState }).__buwLineGrader ??= {
  queues: new Map(),
  dirty: new Set(),
  inFlight: new Set(),
  resting: new Map(),
  urgent: [],
  waiters: new Map(),
  owners: null,
  turn: 0,
  active: 0,
  pumping: false,
  pumpAgain: false,
});

/** Something changed for this student (or, with no email, for everyone): look again. */
export function kick(email?: string): void {
  if (email) {
    S.dirty.add(email);
    if (S.owners && !S.owners.includes(email)) S.owners = null;
  } else {
    S.owners = null;
    S.queues.clear();
  }
  void pump();
}

/** Forgets a student's queue, after their resume is deleted. */
export function forget(email: string): void {
  S.queues.delete(email);
  S.dirty.delete(email);
  S.owners = S.owners?.filter((o) => o !== email) ?? null;
}

/** Checks this posting now, ahead of everything else; resolves once it is done or failed. */
export function checkNow(email: string, jobId: string): Promise<void> {
  const key = keyOf(email, jobId);
  S.resting.delete(key);
  const done = new Promise<void>((resolve) => {
    const list = S.waiters.get(key) ?? [];
    list.push(resolve);
    S.waiters.set(key, list);
    setTimeout(resolve, WAIT_TIMEOUT_MS);
  });
  if (!S.inFlight.has(key)) S.urgent.push({ email, jobId });
  void pump();
  return done;
}

export interface QueueState {
  running: boolean;
  queued: number;
  // Postings whose check failed and is waiting to be tried again.
  retrying: number;
}

export function graderState(email: string): QueueState {
  const queued = (S.queues.get(email)?.length ?? 0) + S.urgent.filter((u) => u.email === email).length;
  const running = [...S.inFlight].some((k) => k.startsWith(`${email}|`));
  const now = Date.now();
  const retrying = [...S.resting].filter(([k, until]) => k.startsWith(`${email}|`) && until > now).length;
  return { running: running || queued > 0 || retrying > 0, queued, retrying };
}

async function pump(): Promise<void> {
  if (S.pumping) {
    S.pumpAgain = true;
    return;
  }
  S.pumping = true;
  try {
    do {
      S.pumpAgain = false;
      while (S.active < CONCURRENCY) {
        const task = await nextTask();
        if (!task) break;
        S.active++;
        task.jobIds.forEach((id) => S.inFlight.add(keyOf(task.email, id)));
        void run(task).finally(() => {
          S.active--;
          task.jobIds.forEach((id) => {
            const key = keyOf(task.email, id);
            S.inFlight.delete(key);
            S.waiters.get(key)?.forEach((resolve) => resolve());
            S.waiters.delete(key);
          });
          void pump();
        });
      }
    } while (S.pumpAgain);
  } catch (err) {
    console.error("[line-check] scheduling failed:", err);
  } finally {
    S.pumping = false;
  }
}

interface Task {
  email: string;
  jobIds: string[];
}

async function nextTask(): Promise<Task | null> {
  while (S.urgent.length > 0) {
    const { email, jobId } = S.urgent.shift()!;
    if (!S.inFlight.has(keyOf(email, jobId))) return { email, jobIds: [jobId] };
  }

  S.owners ??= (await resumesInUse()).map((r) => r.email);
  for (let tried = 0; tried < S.owners.length; tried++) {
    const email = S.owners[S.turn++ % S.owners.length];
    if (S.dirty.has(email) || !S.queues.has(email)) {
      S.dirty.delete(email);
      S.queues.set(email, await buildQueue(email));
    }
    const queue = S.queues.get(email)!;
    const jobIds: string[] = [];
    while (queue.length > 0 && jobIds.length < POSTINGS_PER_CALL) {
      const jobId = queue.shift()!;
      const key = keyOf(email, jobId);
      const until = S.resting.get(key);
      if (S.inFlight.has(key) || (until && until > Date.now())) continue;
      jobIds.push(jobId);
    }
    if (jobIds.length > 0) return { email, jobIds };
  }
  return null;
}

async function buildQueue(email: string): Promise<string[]> {
  const resume = await activeResume(email);
  if (!resume || (await isPaused(email))) return [];
  const pending = await pendingPostings(resume.id, resume.version);
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
  const resume = await activeResume(task.email);
  if (!resume) return;
  const [postings, stored] = await Promise.all([postingsForCheck(task.jobIds), storedChecks(resume.id, task.jobIds)]);

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
      await writeCheck(resume, {
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
  let callFailed = false;
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
        // A timeout or a gateway error says nothing about these postings.
        console.error(`[line-check] call failed for ${remaining.map((p) => p.jobId).join(",")}:`, err);
        callFailed = true;
        break;
      }
      continue;
    }
    const graded = verifyGrades(answer, remaining, citable);
    // The resume may have changed while the model was reading the old one.
    const latest = await activeResume(resume.email);
    if (!latest || latest.id !== resume.id || latest.version !== resume.version) return;
    for (const { jobId, grades } of graded) {
      const plan = batch.find((p) => p.posting.jobId === jobId)!;
      const merged = mergeGrades(plan.base, grades);
      await writeCheck(resume, {
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
  const rest = callFailed ? RETRY_REST_MS : FAILURE_REST_MS;
  for (const { jobId } of remaining) S.resting.set(keyOf(resume.email, jobId), Date.now() + rest);
  if (remaining.length > 0) {
    const wait = Math.round(rest / 60_000);
    console.error(
      `[line-check] ${remaining.length} posting(s) to try again in ${wait} min: ${remaining.map((p) => p.jobId).join(",")}`
    );
  }
  // Something is waiting: come back to it once its rest is over.
  if (remaining.length > 0) setTimeout(() => kick(resume.email), rest + 1000);
}
