import { describe, expect, it } from "vitest";
import { computeMatchScore, type JobForMatch } from "./match-engine";
import type { ResumeProfile } from "./types";

const profile = {
  skills: [{ name: "Python", proficiency: "advanced" }],
  coopTermCount: 2,
} as unknown as ResumeProfile;

function job(overrides: Partial<JobForMatch>): JobForMatch {
  return {
    level: null,
    requiredSkills: "Experience with the next generation of Node and Express tooling",
    jobSummary: null,
    specialRequirements: null,
    aiSkills: null,
    hiresByWorkTermNumber: null,
    ...overrides,
  };
}

describe("computeMatchScore skills", () => {
  it("marks a posting whose skills are not extracted yet as pending, and guesses none", () => {
    const score = computeMatchScore(profile, null, job({ aiSkills: null }));
    expect(score.debug.skills.source).toBe("pending");
    expect(score.debug.skills.jobSkills).toEqual([]);
  });

  it("uses the extracted skills once they exist", () => {
    const score = computeMatchScore(profile, null, job({ aiSkills: ["Python", "SQL"] }));
    expect(score.debug.skills.source).toBe("ai");
    expect(score.debug.skills.missing).toEqual(["SQL"]);
    // One of two matched, read alongside three imagined at the typical 40%.
    expect(score.breakdown.skills).toBe(31);
  });

  it("gives a posting with nothing to go on a neutral skills score, not zero", () => {
    expect(computeMatchScore(profile, null, job({ aiSkills: null })).breakdown.skills).toBe(28);
    expect(computeMatchScore(profile, null, job({ aiSkills: [] })).breakdown.skills).toBe(28);
  });

  it("ranks a full match of a long list above a full match of a short one", () => {
    const short = computeMatchScore(profile, null, job({ aiSkills: ["Python"] }));
    const many = { ...profile, skills: Array.from({ length: 10 }, (_, i) => ({ name: `S${i}`, proficiency: "advanced" })) };
    const long = computeMatchScore(many as unknown as ResumeProfile, null, job({ aiSkills: Array.from({ length: 10 }, (_, i) => `S${i}`) }));
    expect(long.breakdown.skills).toBeGreaterThan(short.breakdown.skills);
  });

  it("treats an extraction that found nothing as extracted, not pending", () => {
    const score = computeMatchScore(profile, null, job({ aiSkills: [] }));
    expect(score.debug.skills.source).toBe("ai");
  });
});
