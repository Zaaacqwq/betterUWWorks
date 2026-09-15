import { describe, expect, it } from "vitest";
import { lineGradesPrompt, mergeGrades, verifyGrades, type PostingToGrade } from "./grade";

const postings: PostingToGrade[] = [
  {
    jobId: "100",
    title: "ML Intern",
    lines: [
      { lineNo: 1, section: "req", text: "Python" },
      { lineNo: 3, section: "req", text: "PyTorch" },
    ],
  },
  { jobId: "200", title: "Analyst", lines: [{ lineNo: 2, section: "req", text: "Excel" }] },
];

describe("lineGradesPrompt", () => {
  it("puts the resume once, then each posting's lines under its id", () => {
    const prompt = lineGradesPrompt("R1: Python", postings);
    expect(prompt.match(/R1: Python/g)).toHaveLength(1);
    expect(prompt).toContain("### 100 — ML Intern\n1. Python\n3. PyTorch");
    expect(prompt).toContain("### 200 — Analyst\n2. Excel");
  });
});

describe("verifyGrades", () => {
  const citable = new Set([1, 2, 5]);

  it("keeps whole answers and drops citations of lines that don't exist", () => {
    const out = verifyGrades({ "100": [[1, 2, 1], [3, 1, 9]], "200": [[2, 0, 0]] }, postings, citable);
    expect(out).toEqual([
      { jobId: "100", grades: [[1, 2, 1], [3, 1, 0]] },
      { jobId: "200", grades: [[2, 0, 0]] },
    ]);
  });

  it("leaves out a posting with a line missing, to ask again", () => {
    const out = verifyGrades({ "100": [[1, 2, 1]], "200": [[2, 2, 5]] }, postings, citable);
    expect(out.map((p) => p.jobId)).toEqual(["200"]);
  });

  it("keeps no citation for a line graded as not shown", () => {
    const out = verifyGrades({ "200": [[2, 0, 5]] }, postings, citable);
    expect(out).toEqual([{ jobId: "200", grades: [[2, 0, 0]] }]);
  });

  it("ignores grades outside the scale and answers that aren't objects", () => {
    expect(verifyGrades({ "200": [[2, 3, 1]] }, postings, citable)).toEqual([]);
    expect(verifyGrades(null, postings, citable)).toEqual([]);
  });
});

describe("mergeGrades", () => {
  it("replaces the rechecked lines and keeps the rest", () => {
    expect(mergeGrades([[1, 0, 0], [2, 2, 4]], [[1, 2, 7]])).toEqual([[1, 2, 7], [2, 2, 4]]);
  });
});
