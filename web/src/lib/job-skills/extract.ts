import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { JOB_SKILLS_SYSTEM, jobSkillsPrompt } from "@/lib/ai/prompts";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import { normalizeSkill } from "@/lib/resume/skill-utils";
import { buildSkillSource, hasSkillSource, renderSkillSource } from "./source";
import { verifySkills, type SkillVerdict, type VerifiedSkills } from "./verify";
import { mergeVendorVariants } from "./vendor";

export interface PostingForSkills {
  jobId: string;
  title: string;
  rawDetail: unknown;
}

export type SkillExtraction =
  | { kind: "extracted"; result: VerifiedSkills }
  // Nothing but a title to go on, so no skills are recorded rather than guessed.
  | { kind: "no-source" };

// Any one reading of a posting misses a different handful of the skills it
// names. Measured on 20 postings against everything six readings found
// together: one reading got 63%, two 86%, three 91%, four 96%. Every reading
// is verified against the posting, so merging them adds only skills the posting
// names. They run side by side, so four take about as long as one.
export const READINGS = 4;

// Now and then the model answers in broken JSON (typographic quotes, a mangled
// fence). Asking again almost always gets a clean answer.
const ATTEMPTS = 2;

async function read(jobId: string, postingText: string): Promise<VerifiedSkills> {
  for (let attempt = 1; ; attempt++) {
    const { text } = await generateText({
      model: models.fast,
      providerOptions: FAST_OPTIONS,
      system: JOB_SKILLS_SYSTEM,
      prompt: jobSkillsPrompt(postingText),
    });
    try {
      return verifySkills(parseAiJson(text, `job ${jobId}`), postingText);
    } catch (err) {
      if (!(err instanceof AiJsonError) || attempt >= ATTEMPTS) throw err;
    }
  }
}

// One entry per skill, under the name the most readings used, with the skills
// most readings agreed on first.
export function mergeReadings(readings: VerifiedSkills[]): VerifiedSkills {
  const bySkill = new Map<string, { count: number; names: Map<string, number>; first: number }>();
  let order = 0;
  for (const reading of readings) {
    for (const name of reading.skills) {
      const key = normalizeSkill(name);
      const entry = bySkill.get(key) ?? { count: 0, names: new Map(), first: order++ };
      entry.count++;
      entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
      bySkill.set(key, entry);
    }
  }

  const skills = mergeVendorVariants(
    [...bySkill.values()]
      .sort((a, b) => b.count - a.count || a.first - b.first)
      .map(({ names }) => [...names.entries()].sort((a, b) => b[1] - a[1])[0][0])
  );
  const verdicts: SkillVerdict[] = readings.flatMap((r) => r.verdicts);
  return { skills, verdicts };
}

export async function extractPostingSkills(job: PostingForSkills): Promise<SkillExtraction> {
  const sections = buildSkillSource(job);
  if (!hasSkillSource(sections)) return { kind: "no-source" };

  const postingText = renderSkillSource(sections);
  const settled = await Promise.allSettled(
    Array.from({ length: READINGS }, () => read(job.jobId, postingText))
  );
  const readings = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));

  // A reading that failed only costs some recall; a posting with none has to
  // be tried again later rather than stored as having no skills.
  if (readings.length === 0) {
    const firstFailure = settled.find((s) => s.status === "rejected");
    throw firstFailure?.status === "rejected" ? firstFailure.reason : new Error(`job ${job.jobId}: no readings`);
  }
  return { kind: "extracted", result: mergeReadings(readings) };
}
