import { describe, expect, it } from "vitest";
import { formatAmount, payDisplay, rateForTerm, requirementChips } from "./present";
import type { PayInfo, Requirement } from "./types";

const pay = (overrides: Partial<PayInfo>): PayInfo => ({
  stated: true,
  currency: "CAD",
  currencySource: "location",
  period: "hour",
  periodSource: "stated",
  min: 25,
  max: 30,
  byTerm: [],
  hoursPerWeek: null,
  quote: "",
  hourlyCad: { min: 25, max: 30 },
  ...overrides,
});

describe("formatAmount", () => {
  it("writes each currency its own way", () => {
    expect(formatAmount(3500, "CAD")).toBe("$3,500");
    expect(formatAmount(20.44, "CAD")).toBe("$20.44");
    expect(formatAmount(75, "USD")).toBe("US$75");
    expect(formatAmount(130000, "JPY")).toBe("¥130,000");
    expect(formatAmount(10, "XYZ")).toBe("XYZ 10");
  });
});

describe("payDisplay", () => {
  it("shows Canadian hourly pay as it is", () => {
    expect(payDisplay(pay({}))).toEqual({ text: "$25–30/hr", hourlyCad: null, periodInferred: false, currencyAssumed: false });
  });

  it("adds the C$ hourly figure for other currencies and periods", () => {
    const usd = payDisplay(pay({ currency: "USD", currencySource: "stated", min: 65, max: 75, hourlyCad: { min: 89.7, max: 103.5 } }));
    expect(usd).toMatchObject({ text: "US$65–75/hr", hourlyCad: "≈ C$90–104/hr" });

    const monthly = payDisplay(pay({ period: "month", min: 3500, max: 3850, hourlyCad: { min: 20.19, max: 22.21 } }));
    expect(monthly).toMatchObject({ text: "$3,500–3,850/month", hourlyCad: "≈ C$20–22/hr" });
  });

  it("says when the period or currency wasn't in the posting's words", () => {
    expect(payDisplay(pay({ periodSource: "inferred" }))?.periodInferred).toBe(true);
    expect(payDisplay(pay({ currency: "USD", currencySource: "location" }))?.currencyAssumed).toBe(true);
    expect(payDisplay(pay({ currency: "CAD", currencySource: "location" }))?.currencyAssumed).toBe(false);
  });

  it("shows a ceiling as a ceiling, and figures without a period as they are", () => {
    expect(payDisplay(pay({ min: null, max: 20, hourlyCad: null }))?.text).toBe("Up to $20/hr");
    expect(payDisplay(pay({ period: null, periodSource: null, min: 3250, max: 3250, hourlyCad: null }))?.text).toBe("$3,250");
  });

  it("says when pay is talked about without a figure, and nothing when it isn't mentioned", () => {
    expect(payDisplay(pay({ stated: false }))?.text).toBe("Not stated");
    expect(payDisplay(null)).toBeNull();
  });
});

describe("rateForTerm", () => {
  const table = [1, 2, 3].map((term) => ({ term, amount: 3500 + 70 * (term - 1) }));

  it("finds the student's term, or the last row past the end of the table", () => {
    expect(rateForTerm(table, 2)).toEqual({ term: 2, amount: 3570 });
    expect(rateForTerm(table, 5)).toEqual({ term: 3, amount: 3640 });
    expect(rateForTerm(table, null)).toBeNull();
    expect(rateForTerm([], 2)).toBeNull();
  });
});

describe("requirementChips", () => {
  const req = (kind: Requirement["kind"], required = true): Requirement => ({
    kind,
    summary: kind,
    value: null,
    required,
    quote: "q",
  });

  it("puts what decides eligibility first, required before preferred", () => {
    const chips = requirementChips([req("program"), req("language", false), req("citizenship"), req("drivers_licence", false)]);
    expect(chips.map((c) => c.kind)).toEqual(["citizenship", "drivers_licence", "program", "language"]);
    expect(chips[0]).toMatchObject({ eligibility: true, required: true });
  });
});
