import { NextRequest, after } from "next/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { importPayloadSchema } from "@/lib/import-schema";
import { extractDetailFields, hasDetailFields } from "@/lib/extract-detail";
import { extractRatingsData } from "@/lib/extract-ratings";
import { runPending } from "@/lib/extraction/runner";
import { skillExtractor } from "@/lib/job-skills/run";
import { detailExtractor } from "@/lib/job-details/run";
import { summaryExtractor } from "@/lib/job-summary/run";
import { sql, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/viewer";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// A row synced without its detail — the extension skips gathering details the
// database already holds, then syncs the posting back without one, or sends
// the error stub of a posting it failed to open — keeps the detail it has, and
// everything read from it. Taking the empty detail used to
// wipe the posting's text and every extraction along with it.
const fromDetail = (column: AnyPgColumn) =>
  sql`case when excluded.raw_detail is null then ${column} else ${sql.raw(`excluded.${column.name}`)} end`;

// What each extraction reads: skills the title and the scraped detail
// (lib/job-skills/source.ts), pay and requirements those and the location
// (lib/job-details/source.ts). Only a change to what it read makes a result stale.
const DETAIL_CHANGED = sql`(excluded.raw_detail is not null and ${jobs.rawDetail} is distinct from excluded.raw_detail)`;
const SKILL_SOURCE_CHANGED = sql`(${DETAIL_CHANGED} or ${jobs.title} is distinct from excluded.title)`;
const DETAIL_SOURCE_CHANGED = sql`(${SKILL_SOURCE_CHANGED} or ${jobs.location} is distinct from excluded.location)`;
const staleUnless = (changed: SQL, column: AnyPgColumn) => sql`case when ${changed} then null else ${column} end`;

export async function POST(request: NextRequest) {
  // The extension syncs with the API key; only the owner may overwrite postings.
  const refusal = requireAdmin(request);
  if (refusal) return refusal;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = importPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  const { jobs: jobItems, batchId } = parsed.data;
  const now = new Date();
  let upserted = 0;

  // One transaction for the whole batch: the rows go in one at a time, and
  // without this a page loading mid-import counted a partially written table
  // and reported a total well short of the batch.
  await db.transaction(async (tx) => {
    for (const item of jobItems) {
      // An error stub or an empty read counts as no detail, so it can't
      // replace one the database already holds (see fromDetail).
      const rawDetail = hasDetailFields(item.detail) ? item.detail : null;
      const detail = extractDetailFields(rawDetail);
      const workTermRatings = rawDetail?._workTermRatings ?? null;
      // Read from WaterlooWorks' own charts, so exact — worked out here rather
      // than left to a reprocess nothing was calling.
      const ratings = extractRatingsData(workTermRatings);

      const deadlineAt = item.deadline ? parseDeadline(item.deadline) : null;

      await tx
        .insert(jobs)
        .values({
          jobId: item.jobId,
          title: item.title,
          organization: item.organization,
          division: item.division || null,
          openings:
            typeof item.openings === "number" ? item.openings : null,
          location: item.location || null,
          level: item.level || null,
          deadline: item.deadline || null,
          deadlineAt,
          ...detail,
          rawDetail,
          workTermRatings,
          ...ratings,
          batchId: batchId ?? null,
          importedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: jobs.jobId,
          set: {
            title: sql`excluded.title`,
            organization: sql`excluded.organization`,
            division: sql`excluded.division`,
            openings: sql`excluded.openings`,
            location: sql`excluded.location`,
            level: sql`excluded.level`,
            deadline: sql`excluded.deadline`,
            deadlineAt: sql`excluded.deadline_at`,
            workTerm: fromDetail(jobs.workTerm),
            jobType: fromDetail(jobs.jobType),
            region: fromDetail(jobs.region),
            address: fromDetail(jobs.address),
            locationArrangement: fromDetail(jobs.locationArrangement),
            workTermDuration: fromDetail(jobs.workTermDuration),
            specialRequirements: fromDetail(jobs.specialRequirements),
            jobSummary: fromDetail(jobs.jobSummary),
            jobResponsibilities: fromDetail(jobs.jobResponsibilities),
            requiredSkills: fromDetail(jobs.requiredSkills),
            compensation: fromDetail(jobs.compensation),
            applicationDelivery: fromDetail(jobs.applicationDelivery),
            applicationInfo: fromDetail(jobs.applicationInfo),
            serviceTeam: fromDetail(jobs.serviceTeam),
            rawDetail: fromDetail(jobs.rawDetail),
            // What was read from the old text no longer describes the posting.
            aiSkills: staleUnless(SKILL_SOURCE_CHANGED, jobs.aiSkills),
            aiSkillsAt: staleUnless(SKILL_SOURCE_CHANGED, jobs.aiSkillsAt),
            aiDetails: staleUnless(DETAIL_SOURCE_CHANGED, jobs.aiDetails),
            aiDetailsAt: staleUnless(DETAIL_SOURCE_CHANGED, jobs.aiDetailsAt),
            parsedHourlyMin: staleUnless(DETAIL_SOURCE_CHANGED, jobs.parsedHourlyMin),
            parsedHourlyMax: staleUnless(DETAIL_SOURCE_CHANGED, jobs.parsedHourlyMax),
            // The summary reads what the skills do, and is shared by everyone.
            aiSummary: staleUnless(SKILL_SOURCE_CHANGED, jobs.aiSummary),
            aiSummaryAt: staleUnless(SKILL_SOURCE_CHANGED, jobs.aiSummaryAt),
            workTermRatings: fromDetail(jobs.workTermRatings),
            employerRating: fromDetail(jobs.employerRating),
            employerRatingCount: fromDetail(jobs.employerRatingCount),
            totalHires: fromDetail(jobs.totalHires),
            batchId: sql`excluded.batch_id`,
            updatedAt: now,
          },
        });

      upserted++;
    }
  });

  // New and changed postings are read without anyone having to ask, after the
  // response so a sync is not held up by the model.
  const importedIds = jobItems.map((item) => item.jobId);
  after(() =>
    Promise.all([
      runPending(skillExtractor, importedIds.length, { jobIds: importedIds }),
      runPending(detailExtractor, importedIds.length, { jobIds: importedIds }),
      runPending(summaryExtractor, importedIds.length, { jobIds: importedIds }),
    ])
  );

  return Response.json({
    success: true,
    data: { imported: upserted, batchId: batchId ?? null },
  });
}

function parseDeadline(deadline: string): Date | null {
  try {
    const d = new Date(deadline);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
