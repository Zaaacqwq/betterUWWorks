import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runPending } from "@/lib/extraction/runner";
import { summaryExtractor } from "@/lib/job-summary/run";
import { takeAiQuota } from "@/lib/ai/quota";

const POLL_MS = 1000;
const MAX_WAIT_MS = 30_000;

// A posting's one-line summary. Imports write it in the background; this only
// writes it on the spot for a posting opened before that got to it.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const read = async () =>
    (await db.select({ summary: jobs.aiSummary }).from(jobs).where(eq(jobs.jobId, id)).limit(1))[0];

  const row = await read();
  if (!row) return Response.json({ success: false, error: "Job not found" }, { status: 404 });
  if (row.summary !== null) return Response.json({ success: true, data: { summary: row.summary || null } });

  const refusal = takeAiQuota(request, "summary");
  if (refusal) return refusal;
  const run = await runPending(summaryExtractor, 1, { jobIds: [id] });
  if (run.failures.length > 0) {
    return Response.json({ success: false, error: "Couldn't summarize this posting" }, { status: 502 });
  }
  // Already being summarized by a background run: wait for it rather than
  // answer "no summary" a moment before there is one.
  for (let waited = 0; run.skipped > 0 && waited < MAX_WAIT_MS; waited += POLL_MS) {
    const row = await read();
    if (row?.summary !== null) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const after = await read();
  if (after?.summary === null) {
    return Response.json({ success: false, error: "Still summarizing this posting" }, { status: 503 });
  }
  return Response.json({ success: true, data: { summary: after?.summary || null } });
}
