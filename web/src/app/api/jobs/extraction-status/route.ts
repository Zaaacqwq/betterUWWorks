import { after } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/viewer";
import { EXTRACTIONS } from "@/lib/extraction/extractors";
import { clearResting, countPending, resting, runPending } from "@/lib/extraction/runner";

// How far each reading of the postings has got, and a way to catch up without
// the backfill script. Readings run on this server, so "failed" is what this
// process has seen fail and is resting before it tries again.

export interface ExtractionStatus {
  total: number;
  // Postings with no scraped detail yet: nothing to read until one arrives.
  withoutDetail: number;
  kinds: { kind: string; label: string; done: number; waiting: number; failed: number }[];
}

async function status(): Promise<ExtractionStatus> {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withoutDetail: sql<number>`count(*) filter (where ${jobs.rawDetail} is null)::int`,
      skills: sql<number>`count(${jobs.aiSkillsAt})::int`,
      details: sql<number>`count(${jobs.aiDetailsAt})::int`,
      summary: sql<number>`count(${jobs.aiSummaryAt})::int`,
      lines: sql<number>`count(${jobs.linesAt})::int`,
    })
    .from(jobs);

  const kinds = await Promise.all(
    EXTRACTIONS.map(async ({ kind, label, extractor }) => ({
      kind,
      label,
      done: counts[kind as "skills" | "details" | "summary" | "lines"],
      waiting: await countPending(extractor),
      failed: resting(extractor.name).length,
    }))
  );
  return { total: counts.total, withoutDetail: counts.withoutDetail, kinds };
}

// Progress is only counts, so every viewer may read it; starting a reading
// spends model time across the table and is the owner's call.
export async function GET() {
  return Response.json({ success: true, data: await status() });
}

// Reads every waiting posting, in the background; with { retryFailed: true },
// failed ones too, without waiting out their rest.
export async function POST(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  const body = await request.json().catch(() => ({}));
  if (body?.retryFailed === true) EXTRACTIONS.forEach(({ extractor }) => clearResting(extractor.name));

  const before = await status();
  after(() =>
    Promise.all(
      EXTRACTIONS.map(({ kind, extractor }) => {
        const waiting = before.kinds.find((k) => k.kind === kind)?.waiting ?? 0;
        return waiting > 0 ? runPending(extractor, waiting) : null;
      })
    )
  );
  return Response.json({ success: true, data: before }, { status: 202 });
}
