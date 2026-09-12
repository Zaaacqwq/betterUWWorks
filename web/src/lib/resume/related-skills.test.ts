import { describe, expect, it } from "vitest";
import { areRelated } from "./related-skills";
import { buildCapabilityMap, computeWeightedOverlap } from "./capability-utils";
import type { Capability } from "./types";

describe("areRelated", () => {
  it.each([
    ["Embedded Linux", "Linux"],
    ["AWS Lambda", "AWS"],
    ["React Native", "React"],
    ["SQL Server", "SQL"],
    ["Machine Learning", "Azure Machine Learning"],
    ["Machine Learning Operations", "Machine Learning"],
  ])("relates %s and %s", (a, b) => {
    expect(areRelated(a, b)).toBe(true);
  });

  it.each([
    ["JavaScript", "Java"],
    ["C++", "C"],
    ["Go-to-market strategy", "Go"],
    ["Google Analytics", "Analytics"],
    ["Unit Testing", "Testing"],
    ["Power BI", "Power Automate"],
    ["Data Structures", "Data Analysis"],
    ["Machine vision", "Machine Learning"],
    ["Electric machines", "Machine Learning"],
    ["REST Assured", "REST APIs"],
    ["Linux", "Linux"],
  ])("does not relate %s and %s", (a, b) => {
    expect(areRelated(a, b)).toBe(false);
  });
});

describe("related skills in a match", () => {
  const cap = (name: string): Capability => ({
    name,
    category: "other",
    evidenceSource: "Experience: Dev @ Acme",
    evidenceType: "work_used",
    confidence: 1,
    reasoning: "",
  });

  it("gives half credit for a skill the student knows a related form of", () => {
    const result = computeWeightedOverlap(buildCapabilityMap([cap("Linux"), cap("Python")]), ["Embedded Linux", "Python", "Rust"]);
    expect(result.matched.find((m) => m.skill === "Embedded Linux")).toMatchObject({ via: "Linux", weight: 0.5 });
    expect(result.missing).toEqual(["Rust"]);
    expect(result.overlap).toBe(0.5);
  });

  it("gives full credit, not half, when the student has the skill itself", () => {
    const result = computeWeightedOverlap(buildCapabilityMap([cap("Linux"), cap("Embedded Linux")]), ["Embedded Linux"]);
    expect(result.matched[0]).not.toHaveProperty("via");
    expect(result.overlap).toBe(1);
  });
});
