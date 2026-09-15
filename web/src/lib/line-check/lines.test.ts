import { describe, expect, it } from "vitest";
import { MAX_LINES, cleanLine, splitPosting, splitText } from "./lines";

describe("cleanLine", () => {
  it("strips bullets and list numbering", () => {
    expect(cleanLine("- Experience with Python")).toBe("Experience with Python");
    expect(cleanLine("•  Strong communication")).toBe("Strong communication");
    expect(cleanLine("> Good communicator")).toBe("Good communicator");
    expect(cleanLine("1. Preparation of reports")).toBe("Preparation of reports");
    expect(cleanLine("(a) Official Plan Amendments")).toBe("Official Plan Amendments");
  });

  it("leaves a line that merely starts with a number alone", () => {
    expect(cleanLine("3D printing and CNC machining")).toBe("3D printing and CNC machining");
    expect(cleanLine("2+ years of Java")).toBe("2+ years of Java");
  });
});

describe("splitText", () => {
  it("keeps one line per requirement and drops empty or wordless ones", () => {
    expect(splitText("Python\n\n  - SQL \n---\n•\nExcel")).toEqual(["Python", "SQL", "Excel"]);
  });

  it("splits a paragraph into its sentences", () => {
    const paragraph =
      "The candidate should have a strong working knowledge of computer applications, including Microsoft Office and GIS software. " +
      "They should also be comfortable assisting and providing information to the general public through strong customer service skills.";
    expect(splitText(paragraph)).toEqual([
      "The candidate should have a strong working knowledge of computer applications, including Microsoft Office and GIS software.",
      "They should also be comfortable assisting and providing information to the general public through strong customer service skills.",
    ]);
  });
});

const posting = (rawDetail: Record<string, unknown>) => ({ title: "Intern", rawDetail });

describe("splitPosting", () => {
  it("numbers requirement lines, then duty lines, and leaves the summary out", () => {
    const lines = splitPosting(
      posting({
        "Job Summary": "We are a bank.",
        "Job Responsibilities": "Build dashboards",
        "Required Skills": "Python\nSQL",
        "Compensation and Benefits": "$25/hour",
      })
    );
    expect(lines).toEqual([
      { lineNo: 1, section: "req", text: "Python" },
      { lineNo: 2, section: "req", text: "SQL" },
      { lineNo: 3, section: "duty", text: "Build dashboards" },
    ]);
  });

  it("reads a posting's own sections, with their names as headings", () => {
    const lines = splitPosting(
      posting({
        "Job Summary": "",
        "Required Skills": "",
        "Job Responsibilities": "",
        "What you will do": "Write Java services",
        "What you will bring": "Java\nSQL",
        "Nice to have": "Kafka",
        "Why you'll love working here": "Free lunch",
      })
    );
    expect(lines.map((l) => [l.section, l.text])).toEqual([
      ["req", "What you will bring"],
      ["req", "Java"],
      ["req", "SQL"],
      ["req", "Nice to have"],
      ["req", "Kafka"],
      ["duty", "What you will do"],
      ["duty", "Write Java services"],
    ]);
  });

  it("puts WaterlooWorks' own sections before a posting's, whatever order they're stored in", () => {
    const lines = splitPosting(posting({ "Nice to have": "Kafka", "Required Skills": "Java" }));
    expect(lines.map((l) => l.text)).toEqual(["Java", "Nice to have", "Kafka"]);
  });

  it("finds sections the scraper filed under _sections", () => {
    const lines = splitPosting(posting({ _sections: { a: { Qualifications: "Excel" } } }));
    expect(lines.map((l) => l.text)).toEqual(["Qualifications", "Excel"]);
  });

  it("reads the summary and anything else when the posting has no requirements or duties", () => {
    const lines = splitPosting(posting({ "Required Skills": " ", "Job Summary": "Know Excel.\nLike maps.", "About Us": "A city." }));
    expect(lines.map((l) => [l.section, l.text])).toEqual([
      ["summary", "Know Excel."],
      ["summary", "Like maps."],
      ["summary", "About Us"],
      ["summary", "A city."],
    ]);
  });

  it("drops a line repeated in both sections", () => {
    const lines = splitPosting(posting({ "Required Skills": "Ad hoc requests", "Job Responsibilities": "ad hoc requests" }));
    expect(lines).toHaveLength(1);
  });

  it("stops at the line cap", () => {
    const many = Array.from({ length: 90 }, (_, i) => `Requirement number ${i}`).join("\n");
    expect(splitPosting(posting({ "Required Skills": many }))).toHaveLength(MAX_LINES);
  });
});
