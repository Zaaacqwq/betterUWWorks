import { z } from "zod/v4";
import { streamText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { COVER_LETTER_SYSTEM, coverLetterPrompt } from "@/lib/ai/prompts";
import { takeAiQuota } from "@/lib/ai/quota";

// A letter is ~350 words (~500 tokens). The gateway gives the model's
// thinking a share of this cap and refuses a share under 1,024 — at 2,000 it
// came to 976 and every request failed — so it has to stay well above that.
const MAX_OUTPUT_TOKENS = 4096;

// The resume lives in the student's browser and comes with each request,
// like the match advice's profile does.
const bodySchema = z.object({
  resumeText: z.string().trim().min(50).max(50000),
  program: z.string().trim().max(200).nullish(),
  termNumber: z.number().int().min(1).max(10).nullish(),
  note: z.string().trim().max(500).nullish(),
});

// Drafts a cover letter for this posting from the student's resume, streamed
// as plain text so the letter appears as it is written.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ success: false, error: "Add your resume first — the letter is written from it." }, { status: 400 });
  }

  const [job] = await db
    .select({
      title: jobs.title,
      organization: jobs.organization,
      division: jobs.division,
      workTerm: jobs.workTerm,
      location: jobs.location,
      aiSummary: jobs.aiSummary,
      jobResponsibilities: jobs.jobResponsibilities,
      requiredSkills: jobs.requiredSkills,
      aiSkills: jobs.aiSkills,
    })
    .from(jobs)
    .where(eq(jobs.jobId, id))
    .limit(1);
  if (!job) return Response.json({ success: false, error: "Job not found" }, { status: 404 });

  const refusal = takeAiQuota(request, "cover");
  if (refusal) return refusal;

  const { resumeText, program, termNumber, note } = parsed.data;
  const result = streamText({
    model: models.fast,
    providerOptions: FAST_OPTIONS,
    system: COVER_LETTER_SYSTEM,
    prompt: coverLetterPrompt({
      title: job.title,
      organization: job.organization,
      division: job.division,
      workTerm: job.workTerm,
      location: job.location,
      summary: job.aiSummary || null,
      responsibilities: job.jobResponsibilities,
      requiredSkills: job.requiredSkills,
      postingSkills: job.aiSkills ?? [],
      program: program ?? null,
      termNumber: termNumber ?? null,
      resumeText,
      note: note || null,
    }),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    onError: ({ error }) => console.error(`[cover-letter] ${id}:`, error),
  });
  return result.toTextStreamResponse();
}
