import { db } from "@/db";
import { jobs } from "@/db/schema";
import { isNull, isNotNull, and, or, sql, eq } from "drizzle-orm";
import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { JOB_SKILLS_SYSTEM, jobSkillsPrompt } from "@/lib/ai/prompts";
import { extractExtraText } from "@/lib/extract-detail";
import { parseAiJson } from "@/lib/ai/json";

const MAX_SKILLS = 15;
const MAX_BATCH = 50;
const DEFAULT_BATCH = 10;
const CONCURRENCY = 4;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(MAX_BATCH, Math.max(1, body.limit ?? DEFAULT_BATCH));

  // Only postings that have been through a detail scrape. Given nothing but a
  // title the model invents plausible-sounding skills, and because a row is
  // picked up once and never revisited, that guess would outlive the real data.
  const hasSource = and(
    isNull(jobs.aiSkills),
    or(
      isNotNull(jobs.requiredSkills),
      isNotNull(jobs.jobSummary),
      isNotNull(jobs.jobResponsibilities),
      isNotNull(jobs.rawDetail)
    )
  );

  const pending = await db
    .select({
      jobId: jobs.jobId,
      title: jobs.title,
      requiredSkills: jobs.requiredSkills,
      jobSummary: jobs.jobSummary,
      jobResponsibilities: jobs.jobResponsibilities,
      rawDetail: jobs.rawDetail,
    })
    .from(jobs)
    .where(hasSource)
    .orderBy(jobs.importedAt)
    .limit(limit);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(hasSource);

  const totalRemaining = countResult.count;

  const failures: { jobId: string; reason: string }[] = [];

  async function extractOne(job: (typeof pending)[number]): Promise<boolean> {
    try {
      const extraText = extractExtraText(job.rawDetail);

      const { text: raw } = await generateText({
        model: models.fast,
        providerOptions: FAST_OPTIONS,
        system: JOB_SKILLS_SYSTEM,
        prompt: jobSkillsPrompt({
          title: job.title,
          requiredSkills: job.requiredSkills,
          jobSummary: job.jobSummary,
          jobResponsibilities: job.jobResponsibilities,
          extraText,
        }),
      });

      const parsed = parseAiJson(raw, `job ${job.jobId}`);
      if (!Array.isArray(parsed)) {
        failures.push({ jobId: job.jobId, reason: "expected a JSON array of skills" });
        return false;
      }

      const skills = parsed
        .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s: string) => s.trim())
        .slice(0, MAX_SKILLS);

      await db
        .update(jobs)
        .set({ aiSkills: skills, aiSkillsAt: new Date() })
        .where(eq(jobs.jobId, job.jobId));

      return true;
    } catch (err) {
      failures.push({
        jobId: job.jobId,
        reason: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // The postings are independent, so run a few at a time. Kept low because the
  // gateway is shared with the interactive match and summary calls.
  let processed = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const results = await Promise.all(pending.slice(i, i + CONCURRENCY).map(extractOne));
    processed += results.filter(Boolean).length;
  }

  // A batch that extracted nothing used to look identical to one with nothing
  // left to do, so report what failed and why.
  return Response.json({
    success: true,
    data: {
      processed,
      failed: failures.length,
      remaining: totalRemaining - processed,
      failures: failures.slice(0, 10),
    },
  });
}
