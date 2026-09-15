import { describe, expect, it } from "vitest";
import {
  DISOWNED_PREFIX,
  buildResumeLines,
  renderResume,
  resumeTextLines,
  skillLines,
  skillOfLine,
  updateSkillLines,
} from "./resume-lines";

const RESUME = `(437) 555-0100                         Portfolio: example.dev
jane.doe@uwaterloo.ca          Jane Doe          GitHub: github.com/janedoe
SKILLS
Languages: Java, Python, C/C++
• Built a RAG application with FastAPI
github.com/janedoe/rag-app                 Personal Project`;

describe("resumeTextLines", () => {
  it("keeps what the resume says and drops contact details", () => {
    const lines = resumeTextLines(RESUME);
    expect(lines).toContain("SKILLS");
    expect(lines).toContain("Languages: Java, Python, C/C++");
    expect(lines).toContain("• Built a RAG application with FastAPI");
    expect(lines.join("\n")).not.toMatch(/@|555-0100|Portfolio/);
  });

  it("keeps a project line that only carries a link beside its label", () => {
    expect(resumeTextLines("github.com/janedoe/rag-app   Personal Project")).toEqual([
      "github.com/janedoe/rag-app Personal Project",
    ]);
  });
});

describe("resumeTextLines on a resume that lost its line breaks", () => {
  const flat =
    "Jane Doe SKILLS Languages: Java, Python, R Databases: MySQL, PostgreSQL EXPERIENCE Intern Jan 2026 — Apr 2026 Acme " +
    "• Built a RAG app with FastAPI. • Wrote unit tests with Jest. Analyst Co-op May 2025 — Aug 2025 Bank " +
    "• Automated reports in Excel.";

  it("breaks it at bullets, sentences and section titles, losing nothing", () => {
    expect(resumeTextLines(flat)).toEqual([
      "Jane Doe",
      "SKILLS Languages: Java, Python, R Databases: MySQL, PostgreSQL",
      "EXPERIENCE Intern Jan 2026 — Apr 2026 Acme",
      "• Built a RAG app with FastAPI.",
      "• Wrote unit tests with Jest.",
      "Analyst Co-op May 2025 — Aug 2025 Bank",
      "• Automated reports in Excel.",
    ]);
  });

  it("cuts a very long line between words instead of dropping the rest", () => {
    const long = Array.from({ length: 120 }, (_, i) => `skill${i}`).join(", ");
    const lines = resumeTextLines(long);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(long);
  });
});

describe("resumeTextLines on a resume with its line breaks", () => {
  it("joins a bullet the PDF wrapped onto a second line", () => {
    expect(resumeTextLines("• Maintained test infrastructure, resolving build and test\nexecution issues.\n• Wrote tests")).toEqual([
      "• Maintained test infrastructure, resolving build and test execution issues.",
      "• Wrote tests",
    ]);
  });
});

describe("skillLines", () => {
  it("writes a line for each skill the student added or rated", () => {
    expect(skillLines(["Docker", "Rust"], { docker: "familiar", java: "proficient", sap: "none" })).toEqual([
      "Added by the student: Docker (has used it a little)",
      "Added by the student: Rust (knows it well)",
      "The student rates their java: knows it well",
      `${DISOWNED_PREFIX}: sap`,
    ]);
  });
});

describe("updateSkillLines", () => {
  const base = buildResumeLines("Python\nSQL");

  it("appends new skill lines after the resume's own", () => {
    const { lines, added, removed } = updateSkillLines(base, ["Added by the student: Docker (knows it well)"]);
    expect(added.map((l) => l.n)).toEqual([3]);
    expect(removed).toEqual([]);
    expect(renderResume(lines)).toBe("R1: Python\nR2: SQL\nR3: Added by the student: Docker (knows it well)");
  });

  it("switches a dropped skill's line off and never reuses its number", () => {
    const first = updateSkillLines(base, ["A", "B"]).lines;
    const second = updateSkillLines(first, ["B", "C"]);
    expect(second.removed.map((l) => [l.n, l.text])).toEqual([[3, "A"]]);
    expect(second.added.map((l) => [l.n, l.text])).toEqual([[5, "C"]]);
    expect(renderResume(second.lines)).toBe("R1: Python\nR2: SQL\nR4: B\nR5: C");
  });

  it("changes nothing when the skills are the same", () => {
    const first = updateSkillLines(base, ["A"]).lines;
    expect(updateSkillLines(first, ["A"])).toEqual({ lines: first, added: [], removed: [] });
  });
});

describe("skillOfLine", () => {
  it("names the skill a line is about", () => {
    expect(skillOfLine("Added by the student: Node.js (knows it well)")).toBe("Node.js");
    expect(skillOfLine("The student rates their java: has used it a little")).toBe("java");
    expect(skillOfLine(`${DISOWNED_PREFIX}: sap`)).toBe("sap");
    expect(skillOfLine("Built a RAG app")).toBeNull();
  });
});
