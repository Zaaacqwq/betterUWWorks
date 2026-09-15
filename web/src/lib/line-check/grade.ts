import type { Grade, LineGrade, PostingLine } from "./types";
import { DISOWNED_PREFIX } from "./resume-lines";

// Checking a resume against postings' lines. One call reads the whole resume
// once and the lines of several postings; the resume is short enough that
// every line sees all of it, rather than only passages picked out for it.

export const LINE_GRADES_SYSTEM = `You check a co-op student's resume against lines from job postings.
Resume lines are numbered R1, R2, ... Each posting's lines are numbered 1, 2, ...

For every posting line output [line, grade, evidence]:
- grade 2: the resume clearly shows it.
- grade 1: partly, or only something close (a related tool, a smaller version of the work).
- grade 0: the resume doesn't show it.
- grade -1: nothing a resume could show.
- evidence: the number of the resume line that shows it best (5 for R5), or 0.

Rules:
- A line naming alternatives ("Python, Go, or a similar language") is met by any one of them.
- "Interest in X" or "exposure to X" is met by any work touching X.
- Judge only from the resume. Don't assume skills it doesn't show, and don't count a skill just because it's common for the student's program.
- Lines starting "${DISOWNED_PREFIX}" mean the student does not have that skill whatever else the resume says; never cite them as evidence.

Answer with JSON only, keyed by posting id: {"<posting id>": [[1, 2, 5], [2, 0, 0], ...], ...}`;

export interface PostingToGrade {
  jobId: string;
  title: string;
  lines: PostingLine[];
}

export function lineGradesPrompt(resume: string, postings: PostingToGrade[]): string {
  const blocks = postings.map(
    (p) => `### ${p.jobId} — ${p.title}\n` + p.lines.map((l) => `${l.lineNo}. ${l.text}`).join("\n")
  );
  return `RESUME\n${resume}\n\nPOSTINGS\n\n${blocks.join("\n\n")}`;
}

const GRADES = new Set<number>([2, 1, 0, -1]);

export interface GradedPosting {
  jobId: string;
  grades: LineGrade[];
}

/**
 * The checks for each posting that came back whole: every line asked about,
 * graded, and citing a resume line that exists (or none). A posting with a
 * line missing is left out, to be asked about again.
 */
export function verifyGrades(raw: unknown, postings: PostingToGrade[], citable: Set<number>): GradedPosting[] {
  if (!raw || typeof raw !== "object") return [];
  const answer = raw as Record<string, unknown>;
  const out: GradedPosting[] = [];
  for (const posting of postings) {
    const entries = answer[posting.jobId];
    if (!Array.isArray(entries)) continue;
    const byLine = new Map<number, LineGrade>();
    for (const entry of entries) {
      if (!Array.isArray(entry)) continue;
      const [lineNo, grade, evidence] = entry.map(Number);
      if (!Number.isInteger(lineNo) || !GRADES.has(grade)) continue;
      // A check that cites nothing real, or cites the resume for something it
      // says isn't there, keeps its grade without the citation.
      const cited = grade > 0 && citable.has(evidence) ? evidence : 0;
      byLine.set(lineNo, [lineNo, grade as Grade, cited]);
    }
    if (posting.lines.every((l) => byLine.has(l.lineNo))) {
      out.push({ jobId: posting.jobId, grades: posting.lines.map((l) => byLine.get(l.lineNo)!) });
    }
  }
  return out;
}

/** Puts fresh checks of some lines over a posting's stored ones. */
export function mergeGrades(stored: LineGrade[], fresh: LineGrade[]): LineGrade[] {
  const byLine = new Map(stored.map((g) => [g[0], g]));
  for (const g of fresh) byLine.set(g[0], g);
  return [...byLine.values()].sort((a, b) => a[0] - b[0]);
}
