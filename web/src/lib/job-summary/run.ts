import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Extractor } from "@/lib/extraction/runner";
import { summarizePosting, type PostingForSummary } from "./extract";

// One short call per posting, so a few more at once than the other readings.
// An empty string records a posting with nothing to summarize.
export const summaryExtractor: Extractor<PostingForSummary> = {
  name: "job-summary",
  doneAt: jobs.aiSummaryAt,
  concurrency: 6,
  load: (where, limit) =>
    db
      .select({ jobId: jobs.jobId, title: jobs.title, rawDetail: jobs.rawDetail })
      .from(jobs)
      .where(where)
      .orderBy(jobs.importedAt)
      .limit(limit),
  async process(job) {
    const outcome = await summarizePosting(job);
    await db
      .update(jobs)
      .set({ aiSummary: outcome.kind === "summarized" ? outcome.summary : "", aiSummaryAt: new Date() })
      .where(eq(jobs.jobId, job.jobId));
  },
};
