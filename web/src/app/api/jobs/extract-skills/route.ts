import { db } from "@/db";
import { jobs } from "@/db/schema";
import { isNull, sql, eq } from "drizzle-orm";
import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { JOB_SKILLS_SYSTEM, jobSkillsPrompt } from "@/lib/ai/prompts";
import { extractExtraText } from "@/lib/extract-detail";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const limit = Math.min(50, Math.max(1, body.limit ?? 10));

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
    .where(isNull(jobs.aiSkills))
    .orderBy(jobs.importedAt)
    .limit(limit);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(isNull(jobs.aiSkills));

  const totalRemaining = countResult.count;

  let processed = 0;

  for (const job of pending) {
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

      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) continue;

      const skills = parsed
        .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s: string) => s.trim())
        .slice(0, 15);

      await db
        .update(jobs)
        .set({ aiSkills: skills, aiSkillsAt: new Date() })
        .where(eq(jobs.jobId, job.jobId));

      processed++;
    } catch {
      continue;
    }
  }

  return Response.json({
    success: true,
    data: { processed, remaining: totalRemaining - processed },
  });
}
