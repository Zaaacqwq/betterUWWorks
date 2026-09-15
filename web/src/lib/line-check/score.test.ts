import { describe, expect, it } from "vitest";
import { isCheckable, lineWeight, scoreLines, type ScoredLineTags } from "./score";
import type { LineGrade } from "./types";

const req = (lineNo: number, extra: Partial<ScoredLineTags> = {}): ScoredLineTags => ({
  lineNo,
  section: "req",
  kind: "skill",
  importance: "required",
  ...extra,
});

describe("lineWeight", () => {
  it("multiplies kind, importance and section", () => {
    expect(lineWeight(req(1))).toBe(1);
    expect(lineWeight(req(1, { importance: "preferred" }))).toBe(0.5);
    expect(lineWeight(req(1, { section: "duty", kind: "duty" }))).toBe(0.5);
    expect(lineWeight(req(1, { kind: "trait" }))).toBeCloseTo(0.3);
    expect(isCheckable(req(1, { kind: "eligibility" }))).toBe(false);
  });
});

describe("scoreLines", () => {
  it("works the BrainCo example through to 43.4", () => {
    // 5 requirements, 2 traits, 7 duties, as checked against the owner's resume.
    const lines: ScoredLineTags[] = [
      req(1), req(2), req(3), req(4), req(5),
      req(6, { kind: "trait" }), req(7, { kind: "trait" }),
      ...[8, 9, 10, 11, 12, 13, 14].map((n) => req(n, { section: "duty", kind: "duty" })),
    ];
    const grades: LineGrade[] = [
      [1, 2, 3], [2, 2, 4], [3, 2, 5], [4, 1, 5], [5, 1, 5],
      [6, 1, 9], [7, 1, 9],
      [8, 2, 5], [9, 2, 5], [10, 1, 5], [11, 1, 5], [12, 1, 5], [13, 0, 0], [14, 1, 5],
    ];
    expect(scoreLines(lines, grades)).toEqual({ skills: 43.4, weight: 9.1, earned: 6.3 });
  });

  it("leaves out lines graded as nothing a resume could show", () => {
    const withNa = scoreLines([req(1), req(2)], [[1, 2, 1], [2, -1, 0]]);
    const alone = scoreLines([req(1)], [[1, 2, 1]]);
    expect(withNa).toEqual(alone);
  });

  it("scores a posting with nothing to check at the typical rate", () => {
    expect(scoreLines([], []).skills).toBe(28);
  });

  it("never gives full marks to a posting that asks for one thing", () => {
    expect(scoreLines([req(1)], [[1, 2, 1]]).skills).toBeLessThan(40);
  });
});
