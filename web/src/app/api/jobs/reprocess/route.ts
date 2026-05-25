import { db } from "@/db";
import { jobs } from "@/db/schema";
import { extractDetailFields } from "@/lib/extract-detail";
import { parseCompensation } from "@/lib/parse-compensation";
import { extractRatingsData } from "@/lib/extract-ratings";
import { eq } from "drizzle-orm";

export async function POST() {
  const allJobs = await db
    .select({
      id: jobs.id,
      rawDetail: jobs.rawDetail,
      compensation: jobs.compensation,
      location: jobs.location,
      workTermRatings: jobs.workTermRatings,
    })
    .from(jobs);

  let updated = 0;

  for (const job of allJobs) {
    const fields = extractDetailFields(job.rawDetail);
    const raw = job.rawDetail as Record<string, unknown> | null;
    const workTermRatings = raw?._workTermRatings ?? job.workTermRatings ?? null;

    const comp = fields.compensation || job.compensation;
    const pay = parseCompensation(comp, job.location);
    const ratings = extractRatingsData(workTermRatings);

    await db
      .update(jobs)
      .set({
        ...fields,
        workTermRatings,
        parsedHourlyMin: pay.hourlyMin,
        parsedHourlyMax: pay.hourlyMax,
        employerRating: ratings.employerRating,
        employerRatingCount: ratings.employerRatingCount,
        totalHires: ratings.totalHires,
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
