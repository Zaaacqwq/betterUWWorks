import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { streamText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { MATCH_ANALYSIS_SYSTEM, matchAnalysisPrompt } from "@/lib/ai/prompts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const profile = body.profile;

  if (!profile?.skills) {
    return Response.json(
      { success: false, error: "Invalid resume profile" },
      { status: 400 }
    );
  }

  const result = await db
    .select({
      title: jobs.title,
      organization: jobs.organization,
      level: jobs.level,
      location: jobs.location,
      requiredSkills: jobs.requiredSkills,
      jobSummary: jobs.jobSummary,
      jobResponsibilities: jobs.jobResponsibilities,
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

  const stream = streamText({
    model: models.fast,
    providerOptions: FAST_OPTIONS,
    system: MATCH_ANALYSIS_SYSTEM,
    prompt: matchAnalysisPrompt(profile, result[0]),
  });

  return stream.toTextStreamResponse();
}
