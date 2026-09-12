import { describe, expect, it } from "vitest";
import { verifySummary } from "./verify";

const POSTING = `Job Summary:
You will build internal dashboards for the payments team. The team has 12 engineers.
Responsibilities:
Maintain data pipelines in Python and write SQL reports for finance.`;

describe("verifySummary", () => {
  it("keeps a short summary resting on sentences in the posting", () => {
    const verdict = verifySummary(
      {
        summary: "Build internal dashboards and data pipelines for the payments and finance teams.",
        basis: ["You will build internal dashboards for the payments team."],
      },
      POSTING
    );
    expect(verdict).toEqual({
      summary: "Build internal dashboards and data pipelines for the payments and finance teams.",
    });
  });

  it("rejects a summary whose basis isn't in the posting", () => {
    const verdict = verifySummary({ summary: "Build dashboards.", basis: ["You will lead the AI strategy."] }, POSTING);
    expect(verdict).toMatchObject({ rejected: expect.stringMatching(/in the posting/) });
  });

  it("rejects a summary when any one of its sentences is made up", () => {
    const verdict = verifySummary(
      {
        summary: "Build internal dashboards for the payments team.",
        basis: ["You will build internal dashboards for the payments team.", "You will lead the AI strategy."],
      },
      POSTING
    );
    expect(verdict).toHaveProperty("rejected");
  });

  it("rejects a number from elsewhere in the posting than the sentences it rests on", () => {
    const verdict = verifySummary(
      { summary: "Build dashboards with 12 engineers.", basis: ["You will build internal dashboards for the payments team."] },
      POSTING
    );
    expect(verdict).toHaveProperty("rejected");
  });

  it("takes a number from the job title", () => {
    const verdict = verifySummary(
      { summary: "Support students in CS 106 labs.", basis: ["You will build internal dashboards for the payments team."] },
      POSTING,
      "CS 106 Instructional Support Assistant"
    );
    expect(verdict).toHaveProperty("summary");
  });

  it("rejects a number the posting doesn't state", () => {
    const verdict = verifySummary(
      { summary: "Join a team of 40 engineers building dashboards.", basis: ["The team has 12 engineers."] },
      POSTING
    );
    expect(verdict).toMatchObject({ rejected: expect.stringMatching(/40/) });
  });

  it("keeps a number the posting does state", () => {
    const verdict = verifySummary(
      { summary: "Build dashboards with a team of 12 engineers.", basis: ["The team has 12 engineers."] },
      POSTING
    );
    expect(verdict).toHaveProperty("summary");
  });

  it("rejects an empty, overlong or malformed reply", () => {
    expect(verifySummary({ summary: "", basis: [] }, POSTING)).toHaveProperty("rejected");
    expect(verifySummary({ summary: "word ".repeat(80), basis: ["The team has 12 engineers."] }, POSTING)).toHaveProperty(
      "rejected"
    );
    expect(verifySummary("text", POSTING)).toHaveProperty("rejected");
  });
});
