import { describe, expect, it } from "vitest";
import { applySkillLevels, buildCapabilityMap, computeWeightedOverlap, effectiveWeight } from "./capability-utils";
import type { Capability } from "./types";

const cap = (name: string, overrides: Partial<Capability> = {}): Capability => ({
  name,
  category: "other",
  evidenceSource: "Experience: Dev @ Acme",
  evidenceType: "work_used",
  confidence: 1,
  reasoning: "",
  ...overrides,
});

describe("skill levels", () => {
  it("lets the student's level decide a skill's weight", () => {
    expect(effectiveWeight(cap("Python", { level: "familiar" }))).toBe(0.5);
    expect(effectiveWeight(cap("pandas", { evidenceType: "weak_inferred", confidence: 0.3, level: "proficient" }))).toBe(1);
  });

  it("applies levels by skill name, however it is written", () => {
    const [js, sql] = applySkillLevels([cap("JS"), cap("SQL")], { javascript: "familiar" });
    expect(js.level).toBe("familiar");
    expect(sql.level).toBeUndefined();
  });

  it("counts a skill known only a little for half in the match", () => {
    const map = buildCapabilityMap(applySkillLevels([cap("Python"), cap("SQL")], { sql: "familiar" }));
    const result = computeWeightedOverlap(map, ["Python", "SQL"]);
    expect(result.overlap).toBe(0.75);
    expect(result.matched.find((m) => m.skill === "SQL")).toMatchObject({ level: "familiar", weight: 0.5 });
  });
});
