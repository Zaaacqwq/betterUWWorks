import { generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobLines, jobs } from "@/db/schema";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import type { Extractor } from "@/lib/extraction/runner";
import { splitPosting, type PostingText } from "./lines";
import { LINE_TAGS_SYSTEM, TagsError, lineTagsPrompt, verifyTags } from "./tags";
import type { TaggedLine } from "./types";
import { linesChanged } from "./pipeline";

// Splits each posting into lines and tags them, once, for every student.

export interface PostingForLines extends PostingText {
  jobId: string;
  title: string;
}

const ATTEMPTS = 2;

export async function tagPosting(posting: PostingForLines): Promise<TaggedLine[]> {
  const lines = splitPosting(posting);
  if (lines.length === 0) return [];
  for (let attempt = 1; ; attempt++) {
    const { text } = await generateText({
      model: models.fast,
      providerOptions: FAST_OPTIONS,
      system: LINE_TAGS_SYSTEM,
      prompt: lineTagsPrompt(posting.title, lines),
      // ~12 tokens a line plus the model's thinking, which the gateway carves
      // out of this cap and refuses when its share falls under 1,024.
      maxOutputTokens: 8000,
    });
    try {
      return verifyTags(parseAiJson(text, `lines of job ${posting.jobId}`), lines);
    } catch (err) {
      const retryable = err instanceof AiJsonError || err instanceof TagsError;
      if (!retryable || attempt >= ATTEMPTS) throw err;
    }
  }
}

export async function saveLines(jobId: string, lines: TaggedLine[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(jobLines).where(eq(jobLines.jobId, jobId));
    if (lines.length > 0) {
      await tx.insert(jobLines).values(
        lines.map((l) => ({
          jobId,
          lineNo: l.lineNo,
          section: l.section,
          text: l.text,
          kind: l.kind,
          importance: l.importance,
        }))
      );
    }
    await tx.update(jobs).set({ linesAt: new Date() }).where(eq(jobs.jobId, jobId));
  });
}

// One call per posting; a few at once, leaving room on the gateway for the
// checks and for students' own requests.
export const lineExtractor: Extractor<PostingForLines> = {
  name: "job-lines",
  doneAt: jobs.linesAt,
  concurrency: 4,
  load: (where, limit) =>
    db
      .select({
        jobId: jobs.jobId,
        title: jobs.title,
        rawDetail: jobs.rawDetail,
      })
      .from(jobs)
      .where(where)
      // Open postings first, soonest to close: they are what students are
      // checked against. Closed ones are tagged last, in case one reopens.
      .orderBy(sql`${jobs.deadlineAt} < now()`, jobs.deadlineAt)
      .limit(limit),
  async process(posting) {
    await saveLines(posting.jobId, await tagPosting(posting));
    linesChanged();
  },
};
