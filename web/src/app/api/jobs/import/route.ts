import { NextRequest } from "next/server";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { importPayloadSchema } from "@/lib/import-schema";
import { extractDetailFields } from "@/lib/extract-detail";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.API_KEY;
  if (expectedKey && apiKey !== expectedKey) {
    return Response.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

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

  for (const item of jobItems) {
    const detail = extractDetailFields(item.detail);
    const rawDetail = item.detail as Record<string, unknown> | undefined;
    const workTermRatings = rawDetail?._workTermRatings ?? null;

    const deadlineAt = item.deadline ? parseDeadline(item.deadline) : null;

    await db
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
        rawDetail: item.detail ?? null,
        workTermRatings,
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
          workTerm: sql`excluded.work_term`,
          jobType: sql`excluded.job_type`,
          region: sql`excluded.region`,
          address: sql`excluded.address`,
          locationArrangement: sql`excluded.location_arrangement`,
          workTermDuration: sql`excluded.work_term_duration`,
          specialRequirements: sql`excluded.special_requirements`,
          jobSummary: sql`excluded.job_summary`,
          jobResponsibilities: sql`excluded.job_responsibilities`,
          requiredSkills: sql`excluded.required_skills`,
          compensation: sql`excluded.compensation`,
          applicationDelivery: sql`excluded.application_delivery`,
          applicationInfo: sql`excluded.application_info`,
          serviceTeam: sql`excluded.service_team`,
          rawDetail: sql`excluded.raw_detail`,
          workTermRatings: sql`excluded.work_term_ratings`,
          batchId: sql`excluded.batch_id`,
          updatedAt: now,
        },
      });

    upserted++;
  }

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
