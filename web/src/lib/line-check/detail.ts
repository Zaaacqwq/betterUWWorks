import { isCheckable, lineWeight, scoreLines } from "./score";
import { getResume, postingsForCheck, storedChecks } from "./store";
import type { Grade, LineImportance, LineKind, LineSection } from "./types";

// One posting's check, line by line, as the Match breakdown shows it.

export interface CheckedLine {
  lineNo: number;
  section: LineSection;
  text: string;
  kind: LineKind;
  importance: LineImportance;
  weight: number;
  // null for a line that isn't checked (eligibility, a heading) or not yet.
  grade: Grade | null;
  evidence: string | null;
}

export type CheckDetail =
  // No resume, or the posting hasn't been split into lines yet.
  | { status: "unavailable" }
  | { status: "pending"; lines: CheckedLine[] }
  | { status: "checked"; skills: number; weight: number; earned: number; updating: boolean; lines: CheckedLine[] };

export async function checkDetail(email: string, jobId: string): Promise<CheckDetail> {
  const [resume, [posting], stored] = await Promise.all([
    getResume(email),
    postingsForCheck([jobId]),
    storedChecks(email, [jobId]),
  ]);
  if (!resume || !posting?.linesAt) return { status: "unavailable" };

  const check = stored.get(jobId);
  const current =
    check && check.resumeVersion === resume.version && check.linesAt.getTime() === posting.linesAt.getTime();
  const grades = new Map((current ? check.grades : []).map(([lineNo, grade, evidence]) => [lineNo, { grade, evidence }]));
  const resumeLine = new Map(resume.lines.map((l) => [l.n, l.text]));

  const lines: CheckedLine[] = posting.lines.map((l) => {
    const g = isCheckable(l) ? grades.get(l.lineNo) : undefined;
    return {
      lineNo: l.lineNo,
      section: l.section,
      text: l.text,
      kind: l.kind,
      importance: l.importance,
      weight: lineWeight(l),
      grade: g?.grade ?? null,
      evidence: g && g.evidence > 0 ? (resumeLine.get(g.evidence) ?? null) : null,
    };
  });

  if (!current) return { status: "pending", lines };
  const score = scoreLines(posting.lines, check.grades);
  return { status: "checked", ...score, updating: check.staleLines.length > 0, lines };
}
