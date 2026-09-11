import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Extractor } from "@/lib/extraction/runner";
import { extractPostingSkills, type PostingForSkills } from "./extract";

// Three postings at once, each making READINGS calls (extract.ts).
export const skillExtractor: Extractor<PostingForSkills> = {
  name: "job-skills",
  doneAt: jobs.aiSkillsAt,
  concurrency: 3,
  load: (where, limit) =>
    db
      .select({ jobId: jobs.jobId, title: jobs.title, rawDetail: jobs.rawDetail })
      .from(jobs)
      .where(where)
      .orderBy(jobs.importedAt)
      .limit(limit),
  async process(job) {
    const outcome = await extractPostingSkills(job);
    const skills = outcome.kind === "extracted" ? outcome.result.skills : [];
    await db
      .update(jobs)
      .set({ aiSkills: skills, aiSkillsAt: new Date() })
      .where(eq(jobs.jobId, job.jobId));
  },
};
