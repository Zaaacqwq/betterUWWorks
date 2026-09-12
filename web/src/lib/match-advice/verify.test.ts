import { describe, expect, it } from "vitest";
import { verifyAdvice } from "./verify";
import { eligibilityChecks } from "./facts";
import type { AdviceFacts } from "./facts";
import type { MatchScore } from "@/lib/resume/types";
import type { PostingDetails, Requirement } from "@/lib/job-details/types";

const facts: AdviceFacts = {
  matched: [
    { skill: "Python", evidence: "Experience: Data Analyst · Acme", familiar: false },
    { skill: "SQL", evidence: "Skills section", familiar: false },
    { skill: "Tableau", evidence: "Added by the student", familiar: true },
  ],
  missing: ["Kubernetes", "Go"],
  experiences: [
    { id: 1, label: "Data Analyst · Acme", skills: ["Python", "SQL"] },
    { id: 2, label: "Hackathon project", skills: ["React"] },
  ],
  checks: [],
};

describe("verifyAdvice", () => {
  it("keeps advice that points at the student's experience and the posting's skills", () => {
    const advice = verifyAdvice(
      {
        highlights: [{ experience: 1, skills: ["python", "SQL"], why: "Shows the data work this job is built on." }],
        gaps: [{ skill: "Kubernetes", suggestion: "Mention you're keen to learn it; nothing on the resume covers it." }],
      },
      facts
    );
    expect(advice.highlights).toEqual([
      { experience: "Data Analyst · Acme", skills: ["Python", "SQL"], why: "Shows the data work this job is built on." },
    ]);
    expect(advice.gaps).toEqual([
      { skill: "Kubernetes", suggestion: "Mention you're keen to learn it; nothing on the resume covers it." },
    ]);
  });

  it("drops skills the student doesn't have, and highlights left with none", () => {
    const advice = verifyAdvice(
      {
        highlights: [
          { experience: 2, skills: ["React"], why: "Shows frontend work." },
          { experience: 1, skills: ["Python", "Kubernetes"], why: "Shows data work." },
        ],
      },
      facts
    );
    expect(advice.highlights).toEqual([{ experience: "Data Analyst · Acme", skills: ["Python"], why: "Shows data work." }]);
  });

  it("never has the student lead with a skill they know only a little", () => {
    const advice = verifyAdvice(
      { highlights: [{ experience: 1, skills: ["Tableau", "SQL"], why: "Shows reporting work." }] },
      facts
    );
    expect(advice.highlights[0].skills).toEqual(["SQL"]);
  });

  it("drops an experience the student never listed", () => {
    const advice = verifyAdvice({ highlights: [{ experience: 7, skills: ["Python"], why: "x" }] }, facts);
    expect(advice.highlights).toEqual([]);
  });

  it("drops a gap that isn't one", () => {
    const advice = verifyAdvice(
      { gaps: [{ skill: "Python", suggestion: "Learn it." }, { skill: "Rust", suggestion: "Learn it." }] },
      facts
    );
    expect(advice.gaps).toEqual([]);
  });

  it("drops overlong sentences and survives a malformed reply", () => {
    const long = "word ".repeat(60);
    expect(verifyAdvice({ highlights: [{ experience: 1, skills: ["Python"], why: long }] }, facts).highlights).toEqual([]);
    expect(verifyAdvice("nonsense", facts)).toEqual({ highlights: [], gaps: [] });
  });
});

describe("eligibilityChecks", () => {
  const score = { warnings: [] } as unknown as MatchScore;
  const req = (kind: Requirement["kind"], summary: string, required = true): Requirement => ({
    kind,
    summary,
    value: null,
    required,
    quote: "",
  });
  const details: PostingDetails = {
    pay: null,
    requirements: [
      req("citizenship", "Canadian citizen or PR"),
      req("security_clearance", "Reliability clearance"),
      req("program", "Engineering students"),
      req("language", "French an asset", false),
    ],
  };

  it("lists required eligibility the student hasn't settled", () => {
    expect(eligibilityChecks(details, null, score)).toEqual(["Canadian citizen or PR", "Reliability clearance"]);
  });

  it("leaves out what the student has confirmed", () => {
    expect(
      eligibilityChecks(details, { coopTermNumber: 2, gpa: null, yearLevel: null, program: "", citizenOrPermanentResident: true }, score)
    ).toEqual(["Reliability clearance"]);
  });

  it("does not repeat a match warning", () => {
    const warned = { warnings: [{ type: "citizenship", message: "Canadian citizen or PR" }] } as unknown as MatchScore;
    expect(
      eligibilityChecks(details, { coopTermNumber: 2, gpa: null, yearLevel: null, program: "", citizenOrPermanentResident: false }, warned)
    ).toEqual(["Canadian citizen or PR", "Reliability clearance"]);
  });
});
