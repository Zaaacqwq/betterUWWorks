// Line-by-line matching: a posting is split into its lines, each line tagged
// once for everyone, and every student's resume checked against each line.

// Where on the posting a line came from. "summary" is read only when the
// posting has neither a Required skills nor a Responsibilities section.
export type LineSection = "req" | "duty" | "summary";

export const LINE_KINDS = ["skill", "experience", "duty", "trait", "eligibility", "outcome", "heading", "other"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const LINE_IMPORTANCES = ["required", "preferred"] as const;
export type LineImportance = (typeof LINE_IMPORTANCES)[number];

export interface PostingLine {
  lineNo: number;
  section: LineSection;
  text: string;
}

export interface TaggedLine extends PostingLine {
  kind: LineKind;
  importance: LineImportance;
}

// 2: the resume clearly shows it. 1: partly, or only something close.
// 0: not shown. -1: nothing a resume could show.
export type Grade = 2 | 1 | 0 | -1;

// [line number, grade, resume line cited as evidence or 0]
export type LineGrade = [number, Grade, number];

// A numbered line of the resume as the checks see it. `n` never changes once
// given within a resume version, so a stored citation keeps pointing at the
// same words; a skill the student takes back is kept, inactive.
export interface ResumeLine {
  n: number;
  text: string;
  source: "resume" | "skill";
  active: boolean;
}
