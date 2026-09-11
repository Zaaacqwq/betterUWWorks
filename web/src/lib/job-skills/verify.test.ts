import { describe, expect, it } from "vitest";
import {
  containsMention,
  displayName,
  mentionSupportsSkill,
  foldText,
  verifySkills,
} from "./verify";

const POSTING = `Required Skills:
Proficiency in C/C++ and Python. Experience with k8s and MS Excel is an asset.
Familiar with AI/ML tooling and Postgres. Knowledge of Phython scripting.
We are building the next generation of connected vehicles.
Tools: React, Graph DB (Neptune/Neo4j), LLMs.`;

const source = foldText(POSTING);

describe("containsMention", () => {
  it("finds a mention on word boundaries", () => {
    expect(containsMention(source, "Python")).toBe(true);
    expect(containsMention(source, "MS Excel")).toBe(true);
  });

  it("does not find C inside C++ or F inside F#", () => {
    expect(containsMention(foldText("Experience with C++"), "C")).toBe(false);
    expect(containsMention(foldText("Experience with F#"), "F")).toBe(false);
  });

  it("finds C where the posting lists C/C++", () => {
    expect(containsMention(source, "C")).toBe(true);
    expect(containsMention(source, "C++")).toBe(true);
  });

  it("does not find a word inside a longer word", () => {
    expect(containsMention(foldText("JavaScript developer"), "Java")).toBe(false);
  });

  it("ignores case, spacing and typographic quotes", () => {
    expect(containsMention(foldText("Use of  Power\nBI"), "power bi")).toBe(true);
    expect(containsMention(foldText("the ‘Jira’ board"), "'Jira'")).toBe(true);
  });

  it("does not find text that is not there", () => {
    expect(containsMention(source, "Django")).toBe(false);
  });
});

describe("mentionSupportsSkill", () => {
  it.each([
    ["Kubernetes", "k8s"],
    ["PostgreSQL", "Postgres"],
    ["Excel", "MS Excel"],
    ["Excel", "Microsoft Excel"],
    ["Amazon Web Services", "AWS"],
    ["Large Language Models", "LLMs"],
    ["Machine Learning", "AI/ML"],
    ["Artificial Intelligence", "AI/ML"],
    ["Python", "Phython"],
    ["SolidWorks", "Solid Works"],
    ["Neo4j", "Graph DB (Neptune/Neo4j)"],
  ])("accepts %s for %s", (skill, mention) => {
    expect(mentionSupportsSkill(skill, mention)).toBe(true);
  });

  it.each([
    ["Django", "Python"],
    ["Excel", "spreadsheets"],
    ["React Native", "React"],
    ["JavaScript", "web development"],
    ["Data Visualization", "data analysis"],
    ["C", "R"],
    ["Java", "Jira"],
  ])("rejects %s for %s", (skill, mention) => {
    expect(mentionSupportsSkill(skill, mention)).toBe(false);
  });
});

describe("displayName", () => {
  it("drops the words wrapped around a skill", () => {
    expect(displayName("Knowledge of GD&T")).toBe("GD&T");
    expect(displayName("User Acceptance Testing (UAT)")).toBe("User Acceptance Testing");
    expect(displayName("mechanical engineering knowledge")).toBe("mechanical engineering");
    expect(displayName("Familiar with manufacturing environment")).toBe("manufacturing environment");
    expect(displayName("Ability to read and interpret drawings")).toBe("read and interpret drawings");
  });

  it("keeps a name that is nothing but filler", () => {
    expect(displayName("knowledge")).toBe("knowledge");
  });
});

describe("verifySkills", () => {
  it("keeps skills whose mention is in the posting", () => {
    const result = verifySkills(
      [
        { skill: "Kubernetes", mention: "k8s" },
        { skill: "Excel", mention: "MS Excel" },
      ],
      POSTING
    );
    expect(result.skills).toEqual(["Kubernetes", "Excel"]);
  });

  it("rejects a skill whose mention is not in the posting", () => {
    const result = verifySkills([{ skill: "Django", mention: "Django" }], POSTING);
    expect(result.skills).toEqual([]);
    expect(result.verdicts[0]).toMatchObject({ kind: "rejected", reason: "mention not in posting" });
  });

  it("never reads 'the next generation' as Next.js", () => {
    const asWord = verifySkills([{ skill: "Next.js", mention: "next" }], POSTING);
    const asPhrase = verifySkills([{ skill: "Next.js", mention: "next generation" }], POSTING);
    expect(asWord.skills).toEqual([]);
    expect(asWord.verdicts[0]).toMatchObject({ reason: "used as an everyday word, not a name" });
    expect(asPhrase.skills).toEqual([]);
    expect(asPhrase.verdicts[0]).toMatchObject({ reason: "name not supported by mention" });
  });

  it("accepts an everyday word where the posting writes it as a name", () => {
    const text = "Stack: React, Next, Node. You will excel at Excel.";
    const result = verifySkills(
      [
        { skill: "Next.js", mention: "Next" },
        { skill: "Node.js", mention: "Node" },
        { skill: "Excel", mention: "Excel" },
      ],
      text
    );
    expect(result.skills).toEqual(["Next.js", "Node.js", "Excel"]);
  });

  it("accepts lower-case product names written as a list", () => {
    const text = "Proficient in microsoft office (word, excel, outlook).";
    const result = verifySkills(
      [
        { skill: "Word", mention: "word" },
        { skill: "Excel", mention: "excel" },
        { skill: "Outlook", mention: "outlook" },
      ],
      text
    );
    expect(result.skills).toEqual(["Word", "Excel", "Outlook"]);
  });

  it("does not read an everyday word near a citation as that skill", () => {
    const result = verifySkills(
      [{ skill: "Excel", mention: "Microsoft Office" }],
      "You will excel with Microsoft Office."
    );
    expect(result.skills).toEqual([]);
  });

  it("keeps a name spelled out by the words around its citation", () => {
    const text = "Experience with Motion and Trajectory Planning for robot arms.";
    const result = verifySkills(
      [
        { skill: "Motion Planning", mention: "Motion" },
        { skill: "Trajectory Planning", mention: "Trajectory" },
      ],
      text
    );
    expect(result.skills).toEqual(["Motion Planning", "Trajectory Planning"]);
  });

  it("reads an acronym out of a spelled-out phrase", () => {
    const text = "Handle data extraction, transformation and loading. Maintain BOMs.";
    const result = verifySkills(
      [
        { skill: "ETL", mention: "data extraction, transformation and loading" },
        { skill: "Bill of Materials", mention: "BOMs" },
      ],
      text
    );
    expect(result.skills).toEqual(["ETL", "Bill of Materials"]);
  });

  it("keeps a reworded skill under the posting's own words", () => {
    const result = verifySkills(
      [{ skill: "Regulatory Compliance", mention: "Complying With Regulations" }],
      "Complying With Regulations is part of the role."
    );
    expect(result.skills).toEqual(["Complying With Regulations"]);
  });

  it.each([
    ["Next.js", "Next", "Next Steps: submit your resume by the deadline."],
    ["Next.js", "Next", "Application Process: Next Steps."],
    ["Next.js", "Next", "Next, you will meet the team."],
    ["Microsoft Access", "Access", "Access to mentorship programs is available."],
    ["Excel", "Excel", "Excel in a fast-paced environment."],
    ["Spring", "Spring", "Winter, Spring, Fall terms are available."],
    ["Spring", "Spring", "Spring 2027 work term."],
    ["Go", "Go", "Go beyond the basics with us."],
    ["Microsoft Teams", "Teams", "Teams across the company collaborate daily."],
  ])("does not take a capitalised everyday word for %s: %s", (skill, mention, text) => {
    expect(verifySkills([{ skill, mention }], text).skills).toEqual([]);
  });

  it.each([
    ["Next.js", "Next", "Our stack: React, Next, Node."],
    ["Excel", "Excel", "Excel and PowerPoint are used daily."],
    ["Spring", "Spring", "Build services with Java and Spring."],
    ["Go", "Go", "Services are written in Go."],
    ["Microsoft Access", "Access", "Experience with Access and Excel."],
    ["Spring", "Spring", "Knowledge of Spring, REST, Service-Oriented Architecture."],
    ["Outlook", "Outlook", "Knowledge of Word, PowerPoint, Excel and Outlook is required."],
  ])("takes an everyday word written as a name for %s: %s", (skill, mention, text) => {
    expect(verifySkills([{ skill, mention }], text).skills).toEqual([skill]);
  });

  it("rejects a lower-case everyday word", () => {
    const text = "You will excel in a fast-paced team with access to mentors.";
    const result = verifySkills(
      [
        { skill: "Excel", mention: "excel" },
        { skill: "Microsoft Access", mention: "access" },
      ],
      text
    );
    expect(result.skills).toEqual([]);
  });

  it("falls back to the posting's words when the name goes beyond them", () => {
    const result = verifySkills([{ skill: "React Native", mention: "React" }], POSTING);
    expect(result.skills).toEqual(["React"]);
    expect(result.verdicts[0]).toMatchObject({ kind: "renamed", proposed: "React Native" });
  });

  it("rejects a name that is a different skill from the posting's words", () => {
    const result = verifySkills(
      [
        { skill: "Django", mention: "Python" },
        { skill: "Excel", mention: "spreadsheets" },
      ],
      "Python scripting and spreadsheets"
    );
    expect(result.skills).toEqual([]);
  });

  it("corrects a posting's typo", () => {
    const result = verifySkills([{ skill: "Python", mention: "Phython" }], POSTING);
    expect(result.skills).toEqual(["Python"]);
  });

  it("splits one mention into the skills it names", () => {
    const result = verifySkills(
      [
        { skill: "Artificial Intelligence", mention: "AI/ML" },
        { skill: "Machine Learning", mention: "AI/ML" },
      ],
      POSTING
    );
    expect(result.skills).toEqual(["Artificial Intelligence", "Machine Learning"]);
  });

  it("drops soft skills and vague words even when named", () => {
    const result = verifySkills(
      [
        { skill: "Communication", mention: "communication" },
        { skill: "Programming", mention: "programming" },
        { skill: "English", mention: "English" },
        { skill: "Python", mention: "Python" },
      ],
      "Strong communication and programming skills in Python. Fluent English."
    );
    expect(result.skills).toEqual(["Python"]);
  });

  it("keeps one entry per skill", () => {
    const result = verifySkills(
      [
        { skill: "PostgreSQL", mention: "Postgres" },
        { skill: "Postgres", mention: "Postgres" },
      ],
      POSTING
    );
    expect(result.skills).toEqual(["PostgreSQL"]);
  });

  it("skips malformed entries without failing the rest", () => {
    const result = verifySkills(["Python", { skill: "Python", mention: "Python" }, null], POSTING);
    expect(result.skills).toEqual(["Python"]);
    expect(result.verdicts.filter((v) => v.kind === "rejected")).toHaveLength(2);
  });

  it("throws when the reply is not an array", () => {
    expect(() => verifySkills({ skills: [] }, POSTING)).toThrow(/JSON array/);
  });
});
