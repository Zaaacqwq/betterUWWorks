import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobLines, jobs } from "@/db/schema";
import { EmbedError, embedPostingLines, fromBytes, toBytes } from "./embed";

// Gives every posting line its vector, and keeps them in memory for the search
// in affected.ts. Runs after tagging; if the model is away, lines wait and the
// search matches words instead.

const BATCH = 64;
const OPEN = or(isNull(jobs.deadlineAt), gt(jobs.deadlineAt, sql`now()`));

// One run at a time per process, however many copies of this module Next loads.
const run = ((globalThis as { __buwEmbedRun?: { current: Promise<number> | null } }).__buwEmbedRun ??= { current: null });

/** Embeds lines still without a vector, open postings first. Resolves to how many were done. */
export function embedPendingLines(): Promise<number> {
  run.current ??= embedAll().finally(() => {
    run.current = null;
  });
  return run.current;
}

async function embedAll(): Promise<number> {
  let done = 0;
  for (;;) {
    const rows = await db
      .select({ jobId: jobLines.jobId, lineNo: jobLines.lineNo, text: jobLines.text })
      .from(jobLines)
      .innerJoin(jobs, eq(jobs.jobId, jobLines.jobId))
      .where(and(isNull(jobLines.embedding), OPEN))
      .limit(BATCH);
    if (rows.length === 0) break;
    let vectors: Float32Array[];
    try {
      vectors = await embedPostingLines(rows.map((r) => r.text));
    } catch (err) {
      if (err instanceof EmbedError) {
        console.error(`[line-check] embedding stopped after ${done} lines: ${err.message}`);
        break;
      }
      throw err;
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        await tx
          .update(jobLines)
          .set({ embedding: toBytes(vectors[i]) })
          .where(and(eq(jobLines.jobId, rows[i].jobId), eq(jobLines.lineNo, rows[i].lineNo)));
      }
    });
    done += rows.length;
    index = null;
  }
  return done;
}

export interface LineIndex {
  refs: { jobId: string; lineNo: number }[];
  vectors: Float32Array[];
}

// Rebuilt when lines are embedded, and at most every so often otherwise so
// postings that closed drop out.
const INDEX_TTL_MS = 30 * 60 * 1000;
let index: { built: number; value: Promise<LineIndex> } | null = null;

export function lineIndex(): Promise<LineIndex> {
  if (!index || Date.now() - index.built > INDEX_TTL_MS) {
    index = { built: Date.now(), value: buildIndex() };
  }
  return index.value;
}

async function buildIndex(): Promise<LineIndex> {
  const rows = await db
    .select({ jobId: jobLines.jobId, lineNo: jobLines.lineNo, embedding: jobLines.embedding })
    .from(jobLines)
    .innerJoin(jobs, eq(jobs.jobId, jobLines.jobId))
    .where(and(isNotNull(jobLines.embedding), OPEN));
  return {
    refs: rows.map((r) => ({ jobId: r.jobId, lineNo: r.lineNo })),
    vectors: rows.map((r) => fromBytes(r.embedding!)),
  };
}

/** Lines of these postings, with their text, for a word search. */
export async function linesOf(jobIds: string[]) {
  if (jobIds.length === 0) return [];
  return db
    .select({ jobId: jobLines.jobId, lineNo: jobLines.lineNo, text: jobLines.text })
    .from(jobLines)
    .where(inArray(jobLines.jobId, jobIds));
}
