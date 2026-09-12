import { describe, expect, it } from "vitest";
import { durationRequirement, withDurationRequirement } from "./duration";
import type { PostingDetails } from "./types";

const detail = (duration: string) => ({ "Work Term Duration": duration });

describe("durationRequirement", () => {
  it("reads required and preferred multi-term commitments from the field", () => {
    expect(durationRequirement(detail("8 month consecutive work term required"))).toMatchObject({
      kind: "consecutive_terms",
      required: true,
      summary: "8 month consecutive work term required",
    });
    expect(durationRequirement(detail("8 month consecutive work term preferred"))?.required).toBe(false);
    expect(durationRequirement(detail("2 work term commitment preferred"))?.required).toBe(false);
  });

  it("says a four-month posting asks for no commitment", () => {
    expect(durationRequirement(detail("4 month work term"))).toBeNull();
  });

  it("says nothing when the posting has no such field", () => {
    expect(durationRequirement({ "Job Summary": "x" })).toBeUndefined();
    expect(durationRequirement(null)).toBeUndefined();
  });
});

describe("withDurationRequirement", () => {
  const read: PostingDetails = {
    pay: null,
    requirements: [
      { kind: "citizenship", summary: "Citizen", value: null, required: true, quote: "q" },
      { kind: "consecutive_terms", summary: "8-month preferred", value: null, required: true, quote: "boilerplate" },
    ],
  };

  it("replaces the model's reading with the field's", () => {
    const merged = withDurationRequirement(read, detail("8 month consecutive work term preferred"));
    expect(merged.requirements.map((r) => [r.kind, r.required])).toEqual([
      ["citizenship", true],
      ["consecutive_terms", false],
    ]);
  });

  it("drops the model's reading when the field says four months", () => {
    expect(withDurationRequirement(read, detail("4 month work term")).requirements.map((r) => r.kind)).toEqual(["citizenship"]);
  });

  it("keeps the model's reading when there is no field", () => {
    expect(withDurationRequirement(read, {})).toEqual(read);
  });
});
