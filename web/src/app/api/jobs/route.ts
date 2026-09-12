import { NextRequest } from "next/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { sql, ilike, and, SQL, desc, asc, gte, inArray, or } from "drizzle-orm";
import { REQUIREMENT_KINDS, type RequirementKind } from "@/lib/job-details/types";
import { listedDetails } from "@/lib/job-details/listed";

// The job list page fetches every row in one request so it can score and sort
// against the resume client-side, so this cap has to clear a full term's
// postings. Matches the import schema's per-batch ceiling.
const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() || "";
  const locations = splitParam(params.get("location"));
  const levels = splitParam(params.get("level"));
  const arrangements = splitParam(params.get("arrangement"));
  const durations = splitParam(params.get("duration"));
  const workTerms = splitParam(params.get("workTerm"));
  const jobTypes = splitParam(params.get("jobType"));
  const minPay = parseFloat(params.get("minPay") || "");
  const minRating = parseFloat(params.get("minRating") || "");
  // Requirement kinds whose postings to leave out, e.g. "citizenship" to hide
  // postings that require it. Only what a posting requires, not what it prefers.
  const hiddenRequirements = splitParam(params.get("hideRequirement")).filter((k): k is RequirementKind =>
    (REQUIREMENT_KINDS as readonly string[]).includes(k)
  );
  const sort = params.get("sort") || "deadline";
  const order = params.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(params.get("limit") || String(DEFAULT_LIMIT), 10))
  );
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (q) {
    conditions.push(sql`search_vector @@ plainto_tsquery('english', ${q})`);
  }
  if (locations.length > 0) {
    conditions.push(
      locations.length === 1
        ? ilike(jobs.location, `%${locations[0]}%`)
        : or(...locations.map((l) => ilike(jobs.location, `%${l}%`)))!
    );
  }
  if (levels.length > 0) {
    conditions.push(
      levels.length === 1
        ? ilike(jobs.level, `%${levels[0]}%`)
        : or(...levels.map((l) => ilike(jobs.level, `%${l}%`)))!
    );
  }
  if (arrangements.length > 0) {
    conditions.push(inArray(jobs.locationArrangement, arrangements));
  }
  if (durations.length > 0) {
    conditions.push(
      durations.length === 1
        ? ilike(jobs.workTermDuration, `%${durations[0]}%`)
        : or(...durations.map((d) => ilike(jobs.workTermDuration, `%${d}%`)))!
    );
  }
  if (workTerms.length > 0) {
    conditions.push(inArray(jobs.workTerm, workTerms));
  }
  if (jobTypes.length > 0) {
    conditions.push(inArray(jobs.jobType, jobTypes));
  }
  if (!isNaN(minPay) && minPay > 0) {
    conditions.push(gte(jobs.parsedHourlyMin, minPay));
  }
  if (!isNaN(minRating) && minRating > 0) {
    conditions.push(gte(jobs.employerRating, minRating));
  }
  for (const kind of hiddenRequirements) {
    // Containment on the whole document, which the GIN index on ai_details serves.
    const required = JSON.stringify({ requirements: [{ kind, required: true }] });
    conditions.push(sql`not coalesce(${jobs.aiDetails} @> ${required}::jsonb, false)`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = {
    deadline: jobs.deadlineAt,
    title: jobs.title,
    organization: jobs.organization,
    imported: jobs.importedAt,
    pay: jobs.parsedHourlyMin,
    rating: jobs.employerRating,
    hires: jobs.totalHires,
  }[sort] || jobs.deadlineAt;

  const nullsLast = sort === "pay" || sort === "rating" || sort === "hires";
  const orderExpr = nullsLast
    ? order === "asc"
      ? sql`${sortColumn} asc nulls first`
      : sql`${sortColumn} desc nulls last`
    : order === "asc"
      ? asc(sortColumn)
      : desc(sortColumn);

  const [results, countResult] = await Promise.all([
    db
      .select({
        id: jobs.id,
        jobId: jobs.jobId,
        title: jobs.title,
        organization: jobs.organization,
        division: jobs.division,
        location: jobs.location,
        level: jobs.level,
        deadline: jobs.deadline,
        deadlineAt: jobs.deadlineAt,
        openings: jobs.openings,
        jobType: jobs.jobType,
        workTerm: jobs.workTerm,
        locationArrangement: jobs.locationArrangement,
        workTermDuration: jobs.workTermDuration,
        parsedHourlyMin: jobs.parsedHourlyMin,
        parsedHourlyMax: jobs.parsedHourlyMax,
        employerRating: jobs.employerRating,
        employerRatingCount: jobs.employerRatingCount,
        totalHires: jobs.totalHires,
        aiSkills: jobs.aiSkills,
        aiDetails: jobs.aiDetails,
        hiresByWorkTermNumber: sql<Record<string, number> | null>`${jobs.workTermRatings}->'hiresByWorkTermNumber'`,
      })
      .from(jobs)
      .where(where)
      .orderBy(orderExpr)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(where),
  ]);

  const total = countResult[0]?.count || 0;

  return Response.json({
    success: true,
    // The posting's full text and most of the sentences its details were read
    // from are only needed in the detail view, which fetches its own.
    data: results.map((r) => ({ ...r, aiDetails: listedDetails(r.aiDetails) })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// Wipes the table so a term can be re-scraped from scratch. Postings are
// re-importable from the extension, so there is nothing here to preserve, but
// the caller has to name the count it means to delete: that way a stale page
// cannot clear a batch the user has since imported.
export async function DELETE(request: NextRequest) {
  const expected = parseInt(request.nextUrl.searchParams.get("expected") || "", 10);
  if (!Number.isInteger(expected) || expected < 0) {
    return Response.json(
      { success: false, error: "Pass ?expected=<row count> to confirm" },
      { status: 400 }
    );
  }

  const [{ count: actual }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs);

  if (actual !== expected) {
    return Response.json(
      {
        success: false,
        error: `Table holds ${actual} jobs, not the ${expected} you saw. Refresh and try again.`,
      },
      { status: 409 }
    );
  }

  // Take a copy first. Two confirmations only guard against a stray click; they
  // do nothing for a change of mind, and a term's postings represent hours of
  // scraping that exist nowhere else once this row set is gone. One snapshot is
  // kept, replaced by each clear, and restored with POST /api/jobs/restore.
  await db.transaction(async (tx) => {
    await tx.execute(sql`DROP TABLE IF EXISTS jobs_snapshot`);
    await tx.execute(sql`CREATE TABLE jobs_snapshot AS TABLE jobs`);
    await tx.delete(jobs);
  });

  return Response.json({
    success: true,
    data: { deleted: actual, snapshot: "jobs_snapshot" },
  });
}

function splitParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}
