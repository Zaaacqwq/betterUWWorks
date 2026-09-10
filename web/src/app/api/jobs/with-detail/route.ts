import { db } from "@/db";
import { jobs } from "@/db/schema";
import { isNotNull } from "drizzle-orm";

// The ids the database already holds a scraped detail for. Gathering a detail
// costs a page load each, so a scrape that has been synced should never pay for
// it twice — re-scraping the job list wipes the extension's own copy, and
// without this the only record of what was already done is lost with it.
export async function GET() {
  const rows = await db
    .select({ jobId: jobs.jobId })
    .from(jobs)
    .where(isNotNull(jobs.rawDetail));

  return Response.json({
    success: true,
    data: { jobIds: rows.map((r) => r.jobId) },
  });
}
