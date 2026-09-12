import { db } from "@/db";
import { jobs } from "@/db/schema";
import { sql } from "drizzle-orm";

// The same test as hasDetailFields() in lib/extract-detail.ts: an object with
// no _error and at least one field that is not bookkeeping. `raw_detail is not
// null` counted an error stub as captured, so the extension never went back for
// it. The case keeps jsonb_object_keys away from anything that is not an object.
const HAS_DETAIL_FIELDS = sql`case
  when jsonb_typeof(${jobs.rawDetail}) = 'object' and not (${jobs.rawDetail} ? '_error')
  then exists (select 1 from jsonb_object_keys(${jobs.rawDetail}) k where left(k, 1) <> '_')
  else false
end`;

// The ids the database already holds a scraped detail for. Gathering a detail
// costs a page load each, so a scrape that has been synced should never pay for
// it twice — re-scraping the job list wipes the extension's own copy, and
// without this the only record of what was already done is lost with it.
export async function GET() {
  const rows = await db
    .select({ jobId: jobs.jobId })
    .from(jobs)
    .where(HAS_DETAIL_FIELDS);

  return Response.json({
    success: true,
    data: { jobIds: rows.map((r) => r.jobId) },
  });
}
