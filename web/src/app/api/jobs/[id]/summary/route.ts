import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { streamText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { JOB_SUMMARY_SYSTEM, jobSummaryPrompt } from "@/lib/ai/prompts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db
    .select({
      jobId: jobs.jobId,
      title: jobs.title,
      organization: jobs.organization,
      level: jobs.level,
      location: jobs.location,
      jobSummary: jobs.jobSummary,
      jobResponsibilities: jobs.jobResponsibilities,
      requiredSkills: jobs.requiredSkills,
      specialRequirements: jobs.specialRequirements,
      compensation: jobs.compensation,
      aiSummary: jobs.aiSummary,
    })
    .from(jobs)
    .where(eq(jobs.jobId, id))
    .limit(1);

  if (result.length === 0) {
    return Response.json(
      { success: false, error: "Job not found" },
      { status: 404 }
    );
  }

  const job = result[0];

  if (job.aiSummary) {
    return Response.json({ success: true, data: job.aiSummary, cached: true });
  }

  const stream = streamText({
    model: models.fast,
    providerOptions: FAST_OPTIONS,
    system: JOB_SUMMARY_SYSTEM,
    prompt: jobSummaryPrompt(job),
    async onFinish({ text }) {
      await db
        .update(jobs)
        .set({ aiSummary: text, aiSummaryAt: new Date() })
        .where(eq(jobs.jobId, id));
    },
  });

  return stream.toTextStreamResponse();
}
