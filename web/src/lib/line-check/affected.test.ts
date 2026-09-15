import { describe, expect, it } from "vitest";
import { selectStale, skillPattern } from "./affected";
import type { LineGrade } from "./types";

describe("skillPattern", () => {
  it("matches the skill as a whole word, symbols and all", () => {
    expect(skillPattern("C++").test("Experience in C++ and Python")).toBe(true);
    expect(skillPattern("C").test("Experience in C++")).toBe(false);
    expect(skillPattern("Go").test("Build APIs in Go (Golang)")).toBe(true);
    expect(skillPattern("Go").test("Good communication")).toBe(false);
    expect(skillPattern("Node.js").test("node.js services")).toBe(true);
  });
});

describe("selectStale", () => {
  const checks = new Map<string, LineGrade[]>([
    ["100", [[1, 2, 4], [2, 1, 5], [3, 0, 0], [4, -1, 0]]],
  ]);
  const candidates = new Map([["100", new Set([1, 2, 3, 4])], ["999", new Set([1])]]);

  it("rechecks only lines a gained skill could raise", () => {
    expect(selectStale(candidates, checks, { gained: true, lost: false })).toEqual(new Map([["100", [2, 3]]]));
  });

  it("rechecks only lines a lost skill could lower", () => {
    expect(selectStale(candidates, checks, { gained: false, lost: true })).toEqual(new Map([["100", [1, 2]]]));
  });

  it("rechecks every scored candidate when a level changes, and skips postings not yet checked", () => {
    expect(selectStale(candidates, checks, { gained: true, lost: true })).toEqual(new Map([["100", [1, 2, 3]]]));
  });
});
