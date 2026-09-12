import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { JOB_GLANCE_SYSTEM, jobGlancePrompt } from "@/lib/ai/prompts";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import { buildSkillSource, hasSkillSource, renderSkillSource } from "@/lib/job-skills/source";
import { verifySummary } from "./verify";

export interface PostingForSummary {
  jobId: string;
  title: string;
  rawDetail: unknown;
}

// A reply that isn't JSON, or that fails the checks, gets asked again; after
// that the posting stays waiting and is tried on the next run.
const ATTEMPTS = 3;

export type SummaryExtraction = { kind: "summarized"; summary: string } | { kind: "no-source" };

export async function summarizePosting(job: PostingForSummary): Promise<SummaryExtraction> {
  const sections = buildSkillSource(job);
  if (!hasSkillSource(sections)) return { kind: "no-source" };
  const postingText = renderSkillSource(sections);

  let lastProblem = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const { text } = await generateText({
      model: models.fast,
      providerOptions: FAST_OPTIONS,
      system: JOB_GLANCE_SYSTEM,
      prompt: jobGlancePrompt(postingText),
    });
    try {
      const verdict = verifySummary(parseAiJson(text, `job ${job.jobId}`), postingText, job.title);
      if ("summary" in verdict) return { kind: "summarized", summary: verdict.summary };
      lastProblem = verdict.rejected;
    } catch (err) {
      if (!(err instanceof AiJsonError)) throw err;
      lastProblem = err.message;
    }
  }
  throw new Error(`job ${job.jobId}: no summary passed the checks (${lastProblem})`);
}
