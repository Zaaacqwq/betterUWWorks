import { describe, expect, it } from "vitest";
import { hasDetailFields } from "./extract-detail";

describe("hasDetailFields", () => {
  it("accepts a detail with the posting's fields", () => {
    expect(hasDetailFields({ "Job Summary": "Build things", _workTermRatings: {} })).toBe(true);
  });

  it("rejects the extension's error stub", () => {
    expect(hasDetailFields({ _error: "Timed out waiting for the viewer" })).toBe(false);
    expect(hasDetailFields({ _error: "Failed", "Job Summary": "x" })).toBe(false);
  });

  it("rejects a read holding nothing but underscore keys", () => {
    expect(hasDetailFields({ _workTermRatings: { charts: [] } })).toBe(false);
    expect(hasDetailFields({})).toBe(false);
  });

  it("rejects no detail at all", () => {
    expect(hasDetailFields(null)).toBe(false);
    expect(hasDetailFields(undefined)).toBe(false);
    expect(hasDetailFields([])).toBe(false);
  });
});
