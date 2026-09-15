import { describe, expect, it } from "vitest";
import { TagsError, applyWording, lineTagsPrompt, verifyTags } from "./tags";
import type { PostingLine, TaggedLine } from "./types";

const lines: PostingLine[] = [
  { lineNo: 1, section: "req", text: "Programming experience in Python, Go, or a similar language" },
  { lineNo: 2, section: "req", text: "Bonus Points For" },
  { lineNo: 3, section: "req", text: "Familiarity with Kubernetes" },
  { lineNo: 4, section: "duty", text: "Build APIs in Go" },
];

describe("lineTagsPrompt", () => {
  it("marks where each line came from", () => {
    expect(lineTagsPrompt("Intern", lines)).toContain("1. [REQ] Programming experience");
    expect(lineTagsPrompt("Intern", lines)).toContain("4. [DUTY] Build APIs in Go");
  });
});

describe("verifyTags", () => {
  it("takes the model's tags and carries a heading's importance down its list", () => {
    const tagged = verifyTags(
      { lines: [[1, "skill", "required"], [2, "heading", "required"], [3, "skill", "required"], [4, "duty", "required"]] },
      lines
    );
    expect(tagged.map((t) => [t.kind, t.importance])).toEqual([
      ["skill", "required"],
      ["heading", "required"],
      ["skill", "preferred"],
      // A new section starts a new list.
      ["duty", "required"],
    ]);
  });

  it("fills the odd missing line and ignores unknown kinds", () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ lineNo: i + 1, section: "req" as const, text: `Skill ${i}` }));
    const answer = { lines: ten.slice(1).map((l) => [l.lineNo, "skill", "required"]) };
    const tagged = verifyTags(answer, ten);
    expect(tagged[0].kind).toBe("skill");
    expect(tagged).toHaveLength(10);
  });

  it("asks again when many lines are left untagged", () => {
    expect(() => verifyTags({ lines: [[1, "skill", "required"]] }, lines)).toThrow(TagsError);
    expect(() => verifyTags({}, lines)).toThrow(TagsError);
  });
});

describe("applyWording", () => {
  const line = (text: string, kind: TaggedLine["kind"] = "skill"): TaggedLine => ({
    lineNo: 1,
    section: "req",
    text,
    kind,
    importance: "required",
  });

  it("makes a line preferred by its own words", () => {
    expect(applyWording([line("Knowledge of SQL is an asset")])[0].importance).toBe("preferred");
    expect(applyWording([line("Interest in CI/CD and containers")])[0].importance).toBe("preferred");
    expect(applyWording([line("Experience with SQL")])[0].importance).toBe("required");
  });

  it("ends a preferred list at the next heading that isn't one", () => {
    const tagged = applyWording([
      line("Preferred Qualifications", "heading"),
      line("Experience with AWS"),
      line("Technical", "heading"),
      line("Experience with Java"),
    ]);
    expect(tagged.map((t) => t.importance)).toEqual(["required", "preferred", "required", "required"]);
  });
});
