import { describe, expect, it } from "vitest";
import { computeSkillOverlap, expandSkill, normalizeSkill } from "./skill-utils";

describe("normalizeSkill", () => {
  it.each([
    ["JS", "javascript"],
    ["Postgres", "postgresql"],
    ["k8s", "kubernetes"],
    ["Microsoft Excel", "excel"],
    ["MS Office", "microsoft office"],
    ["Apache Kafka", "kafka"],
    ["  React.js ", "react"],
  ])("maps %s to %s", (raw, canonical) => {
    expect(normalizeSkill(raw)).toBe(canonical);
  });

  it("drops the version from a versioned name", () => {
    expect(normalizeSkill("Java 17")).toBe("java");
    expect(normalizeSkill("Python 3.11")).toBe("python");
  });

  it("keeps a number that is part of the name", () => {
    expect(normalizeSkill("Dynamics 365")).toBe("dynamics 365");
  });

  it("does not treat related skills as the same skill", () => {
    expect(normalizeSkill("GitHub")).not.toBe(normalizeSkill("Git"));
    expect(normalizeSkill("Laravel")).not.toBe(normalizeSkill("PHP"));
    expect(normalizeSkill("Spring Boot")).not.toBe(normalizeSkill("Spring"));
    expect(normalizeSkill("Docker")).not.toBe(normalizeSkill("containers"));
  });
});

describe("expandSkill", () => {
  it("splits a list of alternatives", () => {
    expect(expandSkill("C/C++")).toEqual(["C/C++", "C", "C++"]);
  });

  it("does not split a name that is itself a skill", () => {
    expect(expandSkill("CI/CD")).toEqual(["CI/CD"]);
    expect(expandSkill("PL/SQL")).toEqual(["PL/SQL"]);
  });

  it("strips a generic ending off a specific name", () => {
    expect(expandSkill("Android Development")).toContain("Android");
  });

  it("does not strip a name down to a word too broad to mean anything", () => {
    expect(expandSkill("Web Services")).toEqual(["Web Services"]);
    expect(expandSkill("Data Pipelines")).toEqual(["Data Pipelines"]);
  });
});

describe("computeSkillOverlap", () => {
  it("matches names that differ only in how they are written", () => {
    const result = computeSkillOverlap(
      [
        { name: "JS", proficiency: "advanced" },
        { name: "Microsoft Excel", proficiency: "intermediate" },
      ],
      ["JavaScript", "Excel", "Kubernetes"]
    );
    expect(result.matched).toEqual(["JavaScript", "Excel"]);
    expect(result.missing).toEqual(["Kubernetes"]);
  });

  it("does not count a related skill as the one asked for", () => {
    const result = computeSkillOverlap([{ name: "Web Development", proficiency: "advanced" }], ["Web Services"]);
    expect(result.matched).toEqual([]);
  });
});
