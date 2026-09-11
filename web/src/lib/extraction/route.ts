import { z } from "zod/v4";
import { countPending, runPending, type Extractor } from "./runner";

const MAX_BATCH = 50;
const DEFAULT_BATCH = 10;

const bodySchema = z.object({
  limit: z.number().int().min(1).max(MAX_BATCH).default(DEFAULT_BATCH),
  // ISO time: also redo postings read before it (after a prompt change).
  olderThan: z.iso.datetime({ offset: true }).optional(),
});

// One batch of an extraction, for the routes that expose one. Imports start
// extraction on their own; calling a route is for catching up — a backfill, or
// a re-run after a prompt changes — and is meant to be repeated until nothing
// remains (scripts/extract.mjs does that).
export async function handleExtractionRequest<P extends { jobId: string }>(
  request: Request,
  extractor: Extractor<P>
): Promise<Response> {
  // Same guard as the import: every call spends model time, and olderThan can
  // ask for the whole table again.
  const expectedKey = process.env.API_KEY;
  if (expectedKey && request.headers.get("x-api-key") !== expectedKey) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json(
      { success: false, error: "Invalid request", details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const selection = {
    olderThan: parsed.data.olderThan ? new Date(parsed.data.olderThan) : undefined,
  };
  const { processed, failures, skipped } = await runPending(extractor, parsed.data.limit, selection);
  const remaining = await countPending(extractor, selection);

  // A batch that read nothing used to look identical to one with nothing left
  // to do, so report what failed and why, and what another run has in hand.
  return Response.json({
    success: true,
    data: {
      processed,
      failed: failures.length,
      skipped,
      remaining,
      failures: failures.slice(0, 10),
    },
  });
}
