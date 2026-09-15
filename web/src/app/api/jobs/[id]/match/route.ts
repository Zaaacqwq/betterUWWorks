import { z } from "zod/v4";
import { generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { takeAiQuota } from "@/lib/ai/quota";
import { APPLICATION_ADVICE_SYSTEM, applicationAdvicePrompt } from "@/lib/ai/prompts";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import { computeMatchScore } from "@/lib/resume/match-engine";
import { migrateProfile } from "@/lib/resume/migrate-profile";
import type { ResumeProfile, UserInfo } from "@/lib/resume/types";
import { adviceFacts } from "@/lib/match-advice/facts";
import { verifyAdvice } from "@/lib/match-advice/verify";
import type { ApplicationAdvice } from "@/lib/match-advice/types";

// The profile lives in the student's browser and comes with each request.
// Every string that can reach the prompt is capped, and every item has the
// fields the scoring reads, so a profile saved under an older shape gets a
// 400 rather than crashing the scoring.
const text = (max: number) => z.string().max(max);
const bodySchema = z.object({
  profile: z
    .object({
      capabilities: z
        .array(
          z
            .object({ name: text(100), evidenceSource: text(200).optional(), evidenceType: text(40).optional() })
            .passthrough()
        )
        .max(400)
        .optional(),
      skills: z.array(z.object({ name: text(100), proficiency: text(40).optional() }).passthrough()).max(400).optional(),
      experience: z
        .array(
          z
            .object({
              title: text(200).optional(),
              company: text(200).optional(),
              skills: z.array(text(100)).max(60).optional(),
            })
            .passthrough()
        )
        .max(50)
        .optional(),
      coopTermCount: z.number().optional(),
    })
    .passthrough(),
  userInfo: z.record(z.string(), z.unknown()).nullable().optional(),
  extraSkills: z.array(text(80)).max(100).optional(),
  skillLevels: z.record(text(100), z.enum(["proficient", "familiar", "none"])).optional(),
});

const ATTEMPTS = 2;

// Advice on applying to one posting. The match is worked out here by the same
// code that scores the list, so the advice rests on the same facts the student
// sees; the model only advises on them.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid resume profile" }, { status: 400 });
  }

  const [job] = await db
    .select({
      title: jobs.title,
      organization: jobs.organization,
      level: jobs.level,
      aiSummary: jobs.aiSummary,
      aiSkills: jobs.aiSkills,
      aiDetails: jobs.aiDetails,
      hiresByWorkTermNumber: sql<Record<string, number> | null>`${jobs.workTermRatings}->'hiresByWorkTermNumber'`,
    })
    .from(jobs)
    .where(eq(jobs.jobId, id))
    .limit(1);
  if (!job) return Response.json({ success: false, error: "Job not found" }, { status: 404 });

  const profile = migrateProfile(parsed.data.profile as Record<string, unknown>) as ResumeProfile;
  const userInfo = (parsed.data.userInfo ?? null) as UserInfo | null;
  const extraSkills = parsed.data.extraSkills ?? [];
  const score = computeMatchScore(
    profile,
    userInfo,
    job,
    extraSkills,
    parsed.data.skillLevels
  );
  const facts = adviceFacts(profile, userInfo, extraSkills, job.aiDetails, score);

  let advice: ApplicationAdvice = { highlights: [], gaps: [], checks: facts.checks };
  if (facts.matched.length > 0 || facts.missing.length > 0) {
    const refusal = takeAiQuota(request, "match");
    if (refusal) return refusal;
    const prompt = applicationAdvicePrompt({
      title: job.title,
      organization: job.organization,
      summary: job.aiSummary || null,
      ...facts,
    });
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const { text } = await generateText({
        model: models.fast,
        providerOptions: FAST_OPTIONS,
        system: APPLICATION_ADVICE_SYSTEM,
        prompt,
      });
      try {
        advice = { ...verifyAdvice(parseAiJson(text, `advice for job ${id}`), facts), checks: facts.checks };
        break;
      } catch (err) {
        if (!(err instanceof AiJsonError) || attempt >= ATTEMPTS) {
          return Response.json({ success: false, error: "Couldn't put the advice together" }, { status: 502 });
        }
      }
    }
  }

  return Response.json({ success: true, data: advice });
}
