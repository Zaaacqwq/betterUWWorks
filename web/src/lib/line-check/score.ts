import type { Grade, LineGrade, LineImportance, LineKind, LineSection } from "./types";

// Turns a posting's checked lines into its skills score, out of 70. Each line
// counts by what kind of line it is, whether the posting requires it, and
// where it sits; each check earns full, half or no credit.

export const SKILL_POINTS = 70;

export const KIND_WEIGHT: Record<LineKind, number> = {
  skill: 1,
  experience: 1,
  duty: 1,
  // Hard to show on a resume and easy to claim, so they count for little.
  trait: 0.3,
  // Degree, year, citizenship, licence: shown as warnings, not scored.
  eligibility: 0,
  // What the student will gain, a heading, anything else: nothing to meet.
  outcome: 0,
  heading: 0,
  other: 0,
};

export const IMPORTANCE_WEIGHT: Record<LineImportance, number> = { required: 1, preferred: 0.5 };

// A duty is work the job will teach as much as ask for, so not having done it
// counts for less than missing a stated requirement.
export const SECTION_WEIGHT: Record<LineSection, number> = { req: 1, summary: 1, duty: 0.5 };

export const CREDIT: Record<Exclude<Grade, -1>, number> = { 2: 1, 1: 0.5, 0: 0 };

// Like the name-matching score before it, a short posting says less than a
// long one: the lines are read as if a few more were there, met at a typical
// rate. They sway a two-line posting a lot and a twenty-line one little.
export const TYPICAL_CREDIT = 0.4;
const IMAGINED_LINES = 3;

export interface ScoredLineTags {
  lineNo: number;
  section: LineSection;
  kind: LineKind;
  importance: LineImportance;
}

export function lineWeight(line: Omit<ScoredLineTags, "lineNo">): number {
  return KIND_WEIGHT[line.kind] * IMPORTANCE_WEIGHT[line.importance] * SECTION_WEIGHT[line.section];
}

// Lines worth checking: the rest score nothing whatever the resume says.
export function isCheckable(line: Omit<ScoredLineTags, "lineNo">): boolean {
  return lineWeight(line) > 0;
}

export interface LineScore {
  skills: number;
  // Total weight of the lines that counted, and the credit they earned.
  weight: number;
  earned: number;
}

export function scoreLines(lines: ScoredLineTags[], grades: LineGrade[]): LineScore {
  const byLine = new Map(grades.map(([lineNo, grade]) => [lineNo, grade]));
  let weight = 0;
  let earned = 0;
  for (const line of lines) {
    const grade = byLine.get(line.lineNo);
    if (grade == null || grade === -1) continue;
    const w = lineWeight(line);
    weight += w;
    earned += w * CREDIT[grade];
  }
  const credible = (earned + TYPICAL_CREDIT * IMAGINED_LINES) / (weight + IMAGINED_LINES);
  return { skills: round1(credible * SKILL_POINTS), weight: round2(weight), earned: round2(earned) };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
