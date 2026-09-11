import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Extractor } from "@/lib/extraction/runner";
import { extractPostingDetails, type PostingForDetails } from "./extract";
import type { PostingDetails } from "./types";

const NOTHING_TO_READ: PostingDetails = { pay: null, requirements: [] };

// Six postings at once, each making DETAIL_READINGS calls (extract.ts) — the
// same dozen calls in flight as the skill reading, whose answers are shorter.
// The hourly rate also goes into parsed_hourly_min/max, which the pay filter
// and sort already use.
export const detailExtractor: Extractor<PostingForDetails> = {
  name: "job-details",
  doneAt: jobs.aiDetailsAt,
  concurrency: 6,
  load: (where, limit) =>
    db
      .select({ jobId: jobs.jobId, title: jobs.title, location: jobs.location, rawDetail: jobs.rawDetail })
      .from(jobs)
      .where(where)
      .orderBy(jobs.importedAt)
      .limit(limit),
  async process(job) {
    const outcome = await extractPostingDetails(job);
    const details = outcome.kind === "extracted" ? outcome.reading.details : NOTHING_TO_READ;
    const hourly = details.pay?.hourlyCad ?? null;
    await db
      .update(jobs)
      .set({
        aiDetails: details,
        aiDetailsAt: new Date(),
        parsedHourlyMin: hourly?.min ?? null,
        parsedHourlyMax: hourly?.max ?? null,
      })
      .where(eq(jobs.jobId, job.jobId));
  },
};
