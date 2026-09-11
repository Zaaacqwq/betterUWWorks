import { db } from "@/db";
import { jobs } from "@/db/schema";
import { extractDetailFields } from "@/lib/extract-detail";
import { extractRatingsData } from "@/lib/extract-ratings";
import { eq } from "drizzle-orm";

// Re-derives every field that is read straight out of the scraped detail, for
// when that reading changes. Pay is not among them: it is extracted by the
// model and checked against the posting (lib/job-details), because the old
// pattern matching both missed common formats and got some badly wrong.
export async function POST() {
  const allJobs = await db
    .select({
      id: jobs.id,
      rawDetail: jobs.rawDetail,
      workTermRatings: jobs.workTermRatings,
    })
    .from(jobs);

  let updated = 0;

  for (const job of allJobs) {
    const fields = extractDetailFields(job.rawDetail);
    const raw = job.rawDetail as Record<string, unknown> | null;
    const workTermRatings = raw?._workTermRatings ?? job.workTermRatings ?? null;
    const ratings = extractRatingsData(workTermRatings);

    await db
      .update(jobs)
      .set({
        ...fields,
        workTermRatings,
        ...ratings,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    updated++;
  }

  return Response.json({
    success: true,
    data: { processed: allJobs.length, updated },
  });
}
