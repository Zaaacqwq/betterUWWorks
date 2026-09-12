import { describe, expect, it } from "vitest";
import { verifiedExperience, verifyCapabilities, type RawCapability } from "./verify-capabilities";
import { buildCapabilityMap, computeWeightedOverlap, countedCapabilities } from "./capability-utils";
import type { Capability } from "./types";

const RESUME = `Software Developer, Acme — Built dashboards in React and JS; wrote SQL reports.
Skills: Python, Docker`;

const cap = (name: string, mention: string | null, evidenceType: Capability["evidenceType"] = "work_used"): RawCapability => ({
  name,
  category: "other",
  evidenceSource: "Experience: Software Developer @ Acme",
  evidenceType,
  confidence: 1,
  reasoning: "",
  mention,
});

describe("verifyCapabilities", () => {
  it("keeps skills the resume writes, under their standard names", () => {
    const { capabilities, downgraded } = verifyCapabilities(
      [cap("React", "React"), cap("JavaScript", "JS"), cap("Python", "Python", "explicit")],
      RESUME
    );
    expect(downgraded).toEqual([]);
    expect(capabilities.map((c) => [c.name, c.evidenceType])).toEqual([
      ["React", "work_used"],
      ["JavaScript", "work_used"],
      ["Python", "explicit"],
    ]);
    expect(capabilities[0]).not.toHaveProperty("mention");
  });

  it("turns a skill the resume doesn't write into a suggestion", () => {
    const { capabilities, downgraded } = verifyCapabilities(
      [cap("Kubernetes", "Kubernetes"), cap("TypeScript", null), cap("Django", "Python", "explicit")],
      RESUME
    );
    expect(downgraded).toEqual(["Kubernetes", "TypeScript", "Django"]);
    expect(capabilities.every((c) => c.evidenceType === "inferred")).toBe(true);
  });

  it("leaves skills already marked inferred as they are", () => {
    const { capabilities } = verifyCapabilities([cap("pandas", null, "inferred")], RESUME);
    expect(capabilities[0].evidenceType).toBe("inferred");
  });
});

describe("suggested skills in a match", () => {
  const verified = verifyCapabilities([cap("React", "React"), cap("pandas", null, "inferred")], RESUME).capabilities;

  it("don't count until the student confirms them", () => {
    const map = buildCapabilityMap(countedCapabilities(verified));
    expect(computeWeightedOverlap(map, ["React", "pandas"]).missing).toEqual(["pandas"]);
  });

  it("count once the student sets a level", () => {
    const confirmed = verified.map((c) => (c.name === "pandas" ? { ...c, level: "familiar" as const } : c));
    const map = buildCapabilityMap(countedCapabilities(confirmed));
    expect(computeWeightedOverlap(map, ["React", "pandas"]).missing).toEqual([]);
  });
});

describe("verifiedExperience", () => {
  it("keeps only an experience's skills the resume was shown to have", () => {
    const { capabilities } = verifyCapabilities([cap("React", "React"), cap("Kubernetes", "Kubernetes")], RESUME);
    const [experience] = verifiedExperience(
      [{ title: "Software Developer", company: "Acme", duration: "", skills: ["React", "Kubernetes"], type: "coop" }],
      capabilities
    );
    expect(experience.skills).toEqual(["React"]);
  });
});
