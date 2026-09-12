import { db } from "@/db";
import { jobs } from "@/db/schema";
import { and, inArray, isNotNull, isNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";

// Runs one kind of model extraction (skills, pay and requirements, ...) over
// the postings still waiting for it. Each kind records when it last read a
// posting in its own timestamp column; a posting is waiting while that is
// empty, and the import empties it whenever the posting's text changes.

export interface Extractor<Posting extends { jobId: string }> {
  name: string;
  // Set when a posting has been read; empty means it is waiting.
  doneAt: typeof jobs.aiSkillsAt | typeof jobs.aiDetailsAt | typeof jobs.aiSummaryAt;
  // Postings read at once, each making however many model calls it makes.
  // Kept low because the gateway is shared with the interactive calls.
  concurrency: number;
  load(where: SQL | undefined, limit: number): Promise<Posting[]>;
  // Reads one posting and stores the result; throws to leave it waiting.
  process(posting: Posting): Promise<void>;
}

export interface PendingSelection {
  // Also redo postings read before this time — how a change to a prompt or a
  // check reaches postings read under the old one.
  olderThan?: Date;
  // Only these postings, as after an import.
  jobIds?: string[];
}

export interface ExtractionFailure {
  jobId: string;
  reason: string;
}

export interface ExtractionRun {
  processed: number;
  failures: ExtractionFailure[];
  // Left to another run already reading them, and still counted as pending
  // until it finishes.
  skipped: number;
}

// A posting is waiting when it has a scraped detail to read and has not been
// read since the cut-off. Without a detail there is nothing to read, so it
// waits for the detail rather than being guessed from its title.
export function pendingWhere(
  doneAt: Extractor<{ jobId: string }>["doneAt"],
  { olderThan, jobIds }: PendingSelection,
  resting: string[] = []
): SQL | undefined {
  return and(
    isNotNull(jobs.rawDetail),
    olderThan ? or(isNull(doneAt), lt(doneAt, olderThan)) : isNull(doneAt),
    jobIds ? inArray(jobs.jobId, jobIds) : undefined,
    resting.length > 0 ? notInArray(jobs.jobId, resting) : undefined
  );
}

// A posting whose reading just failed rests before it is tried again. Without
// this it stays first in line and a backfill spends every batch failing the
// same postings until nothing else gets read.
const FAILURE_REST_MS = 30 * 60 * 1000;
const failedAt = new Map<string, Map<string, number>>();

// Lets a student retry failed postings now rather than after their rest.
export function clearResting(name: string): void {
  failedAt.delete(name);
}

export function resting(name: string): string[] {
  const failures = failedAt.get(name);
  if (!failures) return [];
  const now = Date.now();
  for (const [jobId, at] of failures) if (now - at > FAILURE_REST_MS) failures.delete(jobId);
  return [...failures.keys()];
}

export async function countPending<P extends { jobId: string }>(
  extractor: Extractor<P>,
  selection: PendingSelection = {}
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(pendingWhere(extractor.doneAt, selection, resting(extractor.name)));
  return row.count;
}

// Postings being read right now in this process, per kind. An import and a
// manual run can overlap; this keeps them from paying twice for one posting.
const inFlight = new Map<string, Set<string>>();

export async function runPending<P extends { jobId: string }>(
  extractor: Extractor<P>,
  limit: number,
  selection: PendingSelection = {}
): Promise<ExtractionRun> {
  const busy = inFlight.get(extractor.name) ?? new Set<string>();
  inFlight.set(extractor.name, busy);

  const pending = await extractor.load(pendingWhere(extractor.doneAt, selection, resting(extractor.name)), limit);
  const queue = pending.filter((p) => !busy.has(p.jobId));
  queue.forEach((p) => busy.add(p.jobId));
  const skipped = pending.length - queue.length;

  let processed = 0;
  const failures: ExtractionFailure[] = [];

  async function worker(): Promise<void> {
    for (let posting = queue.shift(); posting; posting = queue.shift()) {
      try {
        await extractor.process(posting);
        processed++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[${extractor.name}] extraction failed for ${posting.jobId}: ${reason}`);
        failures.push({ jobId: posting.jobId, reason });
        const rested = failedAt.get(extractor.name) ?? new Map<string, number>();
        rested.set(posting.jobId, Date.now());
        failedAt.set(extractor.name, rested);
      } finally {
        busy.delete(posting.jobId);
      }
    }
  }

  await Promise.all(Array.from({ length: extractor.concurrency }, worker));
  return { processed, failures, skipped };
}
