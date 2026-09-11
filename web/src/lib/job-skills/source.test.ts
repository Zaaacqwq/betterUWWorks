import { describe, expect, it } from "vitest";
import { buildSkillSource, hasSkillSource, renderSkillSource } from "./source";

describe("buildSkillSource", () => {
  it("reads the title and the posting's descriptive fields", () => {
    const sections = buildSkillSource({
      title: "Data Analyst",
      rawDetail: {
        "Job Summary": "Build dashboards in Power BI.",
        "Required Skills": "SQL, Excel",
        Qualifications: "Python is an asset",
      },
    });
    expect(sections.map((s) => s.label)).toEqual([
      "Job Title",
      "Job Summary",
      "Required Skills",
      "Qualifications",
    ]);
  });

  it("leaves out logistics that only name places, portals and pay", () => {
    const text = renderSkillSource(
      buildSkillSource({
        title: "Developer",
        rawDetail: {
          "Job Summary": "Write TypeScript.",
          "Job - City": "Toronto",
          "Application Method": "WaterlooWorks",
          "Compensation and Benefits": "Benefits through Sun Life",
          "Transportation and Housing": "Near the GO station",
          "Targeted Degrees and Disciplines": "Computer Science",
        },
      })
    );
    expect(text).toContain("TypeScript");
    for (const noise of ["Toronto", "WaterlooWorks", "Sun Life", "GO station", "Computer Science"]) {
      expect(text).not.toContain(noise);
    }
  });

  it("reads fields nested in sections and skips internal keys", () => {
    const sections = buildSkillSource({
      title: "Engineer",
      rawDetail: {
        _sections: { "Job Posting Information": { "Job Responsibilities": "Design PCBs in Altium." } },
        _workTermRatings: { anything: "ignored" },
      },
    });
    expect(renderSkillSource(sections)).toContain("Altium");
    expect(renderSkillSource(sections)).not.toContain("ignored");
  });

  it("does not repeat text that appears under two keys", () => {
    const sections = buildSkillSource({
      title: "Engineer",
      rawDetail: { "Job Summary": "Use MATLAB.", Summary: "Use MATLAB." },
    });
    expect(sections).toHaveLength(2);
  });
});

describe("hasSkillSource", () => {
  it("is false for a posting that is only a title", () => {
    expect(hasSkillSource(buildSkillSource({ title: "Software Developer", rawDetail: null }))).toBe(false);
    expect(
      hasSkillSource(buildSkillSource({ title: "Software Developer", rawDetail: { "Job - City": "Waterloo" } }))
    ).toBe(false);
  });

  it("is true once the posting has text to read", () => {
    expect(
      hasSkillSource(buildSkillSource({ title: "Software Developer", rawDetail: { "Job Summary": "Go and gRPC" } }))
    ).toBe(true);
  });
});
