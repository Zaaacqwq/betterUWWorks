import { db } from "@/db";
import { jobs } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const [locations, levels, arrangements, durations, workTerms, jobTypes] =
    await Promise.all([
      groupBy(jobs.location, 50),
      groupBy(jobs.level),
      groupBy(jobs.locationArrangement),
      groupBy(jobs.workTermDuration),
      groupBy(jobs.workTerm),
      groupBy(jobs.jobType),
    ]);

  return Response.json({
    success: true,
    data: {
      locations: toOptions(locations),
      levels: toOptions(levels),
      arrangements: toOptions(arrangements),
      durations: toOptions(durations),
      workTerms: toOptions(workTerms),
      jobTypes: toOptions(jobTypes),
    },
  });
}

async function groupBy(column: Parameters<typeof db.select>[0] extends undefined ? never : unknown, limit = 20) {
  const col = column as typeof jobs.location;
  return db
    .select({
      value: col,
      count: sql<number>`count(*)::int`,
    })
    .from(jobs)
    .where(sql`${col} IS NOT NULL AND ${col} != ''`)
    .groupBy(col)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);
}

function toOptions(rows: { value: string | null; count: number }[]) {
  return rows.map((r) => ({
    label: `${r.value} (${r.count})`,
    value: r.value!,
  }));
}
