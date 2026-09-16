import { after } from "next/server";
import { db } from "@/db";
import { lineGrades, resumes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/viewer";
import { resumeSections } from "@/lib/line-check/resume-lines";
import { scoreLines } from "@/lib/line-check/score";
import { postingsForCheck } from "@/lib/line-check/store";

// Works out every stored check's score again, from the grades and tags already
// in the database. Nothing is sent to a model: this is for a change to the
// weights (lib/line-check/score.ts), which would otherwise only reach postings
// as they happen to be checked again.

const BATCH = 200;

async function rescore(): Promise<{ resumes: number; checks: number }> {
  const held = await db.select().from(resumes);
  let checks = 0;
  for (const resume of held) {
    const sections = resumeSections(resume.lines);
    const rows = await db
      .select({ jobId: lineGrades.jobId, grades: lineGrades.grades })
      .from(lineGrades)
      .where(eq(lineGrades.resumeId, resume.id));
    for (let start = 0; start < rows.length; start += BATCH) {
      const slice = rows.slice(start, start + BATCH);
      const postings = new Map((await postingsForCheck(slice.map((r) => r.jobId))).map((p) => [p.jobId, p]));
      for (const row of slice) {
        const posting = postings.get(row.jobId);
        if (!posting) continue;
        const { skills } = scoreLines(posting.lines, row.grades, sections);
        await db
          .update(lineGrades)
          .set({ skills })
          .where(and(eq(lineGrades.resumeId, resume.id), eq(lineGrades.jobId, row.jobId)));
        checks++;
      }
    }
  }
  return { resumes: held.length, checks };
}

export async function POST(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  after(() =>
    rescore()
      .then((done) => console.log(`[line-check] rescored ${done.checks} checks across ${done.resumes} resumes`))
      .catch((err) => console.error("[line-check] rescoring failed:", err))
  );
  return Response.json({ success: true, data: { started: true } }, { status: 202 });
}
