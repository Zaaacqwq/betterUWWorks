import { describe, expect, it } from "vitest";
import { listedDetails } from "./listed";
import type { PostingDetails } from "./types";

const DETAILS: PostingDetails = {
  pay: {
    stated: true,
    currency: "USD",
    currencySource: "stated",
    period: "hour",
    periodSource: "stated",
    min: 65,
    max: 75,
    byTerm: [],
    hoursPerWeek: null,
    quote: "The range for this role is $65-75 USD per hour.",
    hourlyCad: { min: 89, max: 103 },
  },
  requirements: [
    {
      kind: "citizenship",
      summary: "Canadian citizen or permanent resident",
      value: null,
      required: true,
      quote: "Applicants must be Canadian citizens or permanent residents.",
    },
    {
      kind: "program",
      summary: "Computer Science or Software Engineering",
      value: null,
      required: false,
      quote: "Preference for students in Computer Science or Software Engineering.",
    },
  ],
};

describe("listedDetails", () => {
  it("leaves out the posting's sentences but keeps everything shown and scored", () => {
    const listed = listedDetails(DETAILS)!;
    expect(listed.pay).not.toHaveProperty("quote");
    expect(listed.pay).toMatchObject({ min: 65, max: 75, currency: "USD", hourlyCad: { min: 89, max: 103 } });
    expect(listed.requirements[0]).toEqual({
      kind: "citizenship",
      summary: "Canadian citizen or permanent resident",
      value: null,
      required: true,
    });
  });

  it("keeps a program requirement's sentence, which the match reads", () => {
    expect(listedDetails(DETAILS)!.requirements[1].quote).toBe(DETAILS.requirements[1].quote);
  });

  it("passes on a posting not read yet, or with no pay", () => {
    expect(listedDetails(null)).toBeNull();
    expect(listedDetails({ pay: null, requirements: [] })).toEqual({ pay: null, requirements: [] });
  });

  it("leaves the stored details as they were", () => {
    listedDetails(DETAILS);
    expect(DETAILS.pay!.quote).toBeTruthy();
    expect(DETAILS.requirements[0].quote).toBeTruthy();
  });
});
