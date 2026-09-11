import { describe, expect, it } from "vitest";
import { verifyPay } from "./verify-pay";
import { numbersIn } from "./numbers";

const canada = { country: "Canada" };
const us = { country: "United States" };

function verify(raw: unknown, source: string, where = canada) {
  return verifyPay(raw, { source, ...where });
}

describe("numbersIn", () => {
  it("reads the ways postings write figures", () => {
    const found = numbersIn("$3,500.00 per month, $7.5k USD, $12-16K for the term, 1 3500.00 2 3570.00");
    for (const n of [3500, 7.5, 7500, 12, 16, 16000, 12000, 1, 3570]) expect(found.has(n)).toBe(true);
    expect(found.has(1350)).toBe(false);
  });
});

describe("verifyPay", () => {
  it("reads a table of monthly rates by work term", () => {
    const source = `Compensation and Benefits:
Salary*
WT Monthly ($)
1 3500.00
2 3570.00
3 3640.00
4 3710.00
5 3780.00
6 3850.00`;
    const { pay } = verify(
      {
        quote: "WT Monthly ($) 1 3500.00 2 3570.00 3 3640.00 4 3710.00 5 3780.00 6 3850.00",
        currency: null,
        period: "month",
        min: 3500,
        max: 3850,
        byTerm: [1, 2, 3, 4, 5, 6].map((term, i) => ({ term, amount: 3500 + 70 * i })),
        hoursPerWeek: null,
      },
      source
    );
    expect(pay).toMatchObject({ stated: true, currency: "CAD", currencySource: "location", period: "month", min: 3500, max: 3850 });
    expect(pay?.byTerm).toHaveLength(6);
    expect(pay?.hourlyCad).toEqual({ min: 20.19, max: 22.21 });
  });

  it("reads an hourly range in US dollars and converts it", () => {
    const source = "Compensation and Benefits:\nThe range for this role is $65-75 USD per hour.";
    const { pay } = verify(
      { quote: "The range for this role is $65-75 USD per hour.", currency: "USD", period: "hour", min: 65, max: 75 },
      source,
      us
    );
    expect(pay).toMatchObject({ currency: "USD", currencySource: "stated", period: "hour", min: 65, max: 75 });
    expect(pay?.hourlyCad).toEqual({ min: 89.7, max: 103.5 });
  });

  it("reads thousands for the whole term", () => {
    const source = "The numerical range would be $12-16K for the term.";
    const { pay } = verify(
      { quote: "The numerical range would be $12-16K for the term.", period: "term", min: 12000, max: 16000 },
      source
    );
    expect(pay).toMatchObject({ period: "term", min: 12000, max: 16000, hourlyCad: { min: 18.75, max: 25 } });
  });

  it("uses the weekly hours the posting states", () => {
    const source = "$950 to $1,450 per week. 35 hours per week.";
    const { pay } = verify({ quote: "$950 to $1,450 per week.", period: "week", min: 950, max: 1450, hoursPerWeek: 35 }, source);
    expect(pay?.hourlyCad).toEqual({ min: 27.14, max: 41.43 });
  });

  it("drops a figure the posting doesn't write", () => {
    const { pay, notes } = verify({ quote: "$25-$35/hr", period: "hour", min: 25, max: 38 }, "Pay: $25-$35/hr");
    expect(pay).toMatchObject({ min: 25, max: 25 });
    expect(notes.join()).toMatch(/max 38/);
  });

  it("infers the period only where the figures leave no doubt", () => {
    const annual = verify({ quote: "$42,000.00", period: "year", min: 42000, max: 42000 }, "$42,000.00").pay;
    expect(annual).toMatchObject({ period: "year", periodSource: "inferred", hourlyCad: { min: 20.19, max: 20.19 } });

    const table = "Term 1 Term 2 Term 3 $20.44 $22.72 $24.79";
    const hourly = verify({ quote: table, period: null, min: 20.44, max: 24.79 }, table).pay;
    expect(hourly).toMatchObject({ period: "hour", periodSource: "inferred", hourlyCad: { min: 20.44, max: 24.79 } });
  });

  it("keeps the figures but gives no hourly rate when the period could be several", () => {
    // Weekly, biweekly or monthly — the figure alone can't say which.
    const { pay } = verify({ quote: "$1,500", period: "month", min: 1500 }, "Pay: $1,500");
    expect(pay).toMatchObject({ stated: true, min: 1500, period: null, periodSource: null, hourlyCad: null });
  });

  it("reads biweekly pay", () => {
    const quote = "Term 1 - $1,430.35 biweekly";
    const { pay } = verify({ quote, period: "biweekly", min: 1430.35 }, quote);
    expect(pay).toMatchObject({ period: "biweekly", periodSource: "stated", hourlyCad: { min: 17.88, max: 17.88 } });
  });

  it("does not take a biweekly figure as weekly", () => {
    const quote = "Term 1 - $1,430.35 biweekly";
    const { pay } = verify({ quote, period: "week", min: 1430.35 }, quote);
    expect(pay).toMatchObject({ period: null, hourlyCad: null });
  });

  it("gives no hourly rate for an impossible one", () => {
    // A weekly figure read as hourly.
    const { pay } = verify(
      { quote: "$2700 - $3500 per week (USD)", period: "hour", min: 2700, max: 3500 },
      "$2700 - $3500 per week (USD)",
      us
    );
    expect(pay?.period).toBeNull();
    expect(pay?.hourlyCad).toBeNull();
  });

  it("does not take a currency the posting never names", () => {
    const { pay } = verify({ quote: "$30/hour", currency: "USD", period: "hour", min: 30 }, "$30/hour");
    expect(pay).toMatchObject({ currency: "CAD", currencySource: "location" });
  });

  it("reads a currency only the quote names", () => {
    const source = "The internship allowance is SG$1,500 per month issued by a monthly payroll.";
    const { pay } = verify(
      { quote: "The internship allowance is SG$1,500 per month", period: "month", min: 1500 },
      source,
      { country: "Singapore" }
    );
    expect(pay).toMatchObject({ currency: "SGD", currencySource: "stated" });
  });

  it("does not settle on either currency when the quote names two and the reading names neither", () => {
    const quote = "$75 USD/hour plus $1,000 CAD relocation";
    const { pay } = verify({ quote, period: "hour", min: 75 }, quote, us);
    expect(pay).toMatchObject({ currency: "USD", currencySource: "location" });
  });

  it("records pay talked about without a figure", () => {
    const quote = "Competitive salary based on Math Faculty co-op average.";
    const { pay } = verify({ quote, period: null, min: null, max: null }, quote);
    expect(pay).toMatchObject({ stated: false, currency: null, hourlyCad: null });
  });

  it("rejects pay quoted from words the posting doesn't contain", () => {
    const { pay } = verify({ quote: "$40/hour", period: "hour", min: 40 }, "Pay is $30/hour");
    expect(pay).toBeNull();
  });

  it("drops term rates the posting doesn't write", () => {
    const source = "Term 1 Term 2 Term 3 $20.44 $22.72 $24.79 per hour";
    const { pay } = verify(
      {
        quote: source,
        period: "hour",
        byTerm: [
          { term: 1, amount: 20.44 },
          { term: 2, amount: 22.72 },
          { term: 3, amount: 25.5 },
        ],
      },
      source
    );
    expect(pay?.byTerm).toEqual([
      { term: 1, amount: 20.44 },
      { term: 2, amount: 22.72 },
    ]);
    expect(pay).toMatchObject({ min: 20.44, max: 22.72 });
  });

  it("accepts pay quoted from two places, one passage per line", () => {
    const source = `Why Work With Us?
Competitive Pay - starting at $21.00/hour plus paid overtime
Mentorship

Compensation and Benefits:
Compensation: $21 - $24/hour`;
    const quote = "Competitive Pay - starting at $21.00/hour plus paid overtime\nCompensation: $21 - $24/hour";
    const { pay } = verify({ quote, period: "hour", min: 21, max: 24 }, source);
    expect(pay).toMatchObject({ min: 21, max: 24, hourlyCad: { min: 21, max: 24 } });
  });

  it("never lends a figure from another passage to the pay", () => {
    const source = "Compensation: $21 - $24/hour\n\nSigning bonus of $5,000 upon completion.";
    const quote = "Compensation: $21 - $24/hour\nSigning bonus of $5,000";
    const { pay } = verify({ quote, period: "hour", min: 21, max: 5000 }, source);
    expect(pay).toMatchObject({ min: 21, max: 21 });
  });

  it.each([
    ["on the next line", "Compensation: $21 - $24/hour\nSigning bonus of $5,000"],
    ["in the next sentence", "Compensation: $21 - $24/hour. Signing bonus of $5,000."],
  ])("never takes a bonus %s for the pay", (_where, source) => {
    const { pay } = verify({ quote: source, period: "hour", min: 21, max: 5000 }, source);
    expect(pay).toMatchObject({ min: 21, max: 21, period: "hour" });
  });

  it("reads a table quoted row by row as one passage", () => {
    const source = "Salary*\nWT Monthly ($)\n1 3500.00\n2 3570.00\n3 3640.00";
    const quote = "WT Monthly ($)\n1 3500.00\n2 3570.00\n3 3640.00";
    const { pay } = verify(
      { quote, period: "month", min: 3500, max: 3640, byTerm: [1, 2, 3].map((term, i) => ({ term, amount: 3500 + 70 * i })) },
      source
    );
    expect(pay).toMatchObject({ period: "month", min: 3500, max: 3640 });
    expect(pay?.byTerm).toHaveLength(3);
  });

  it("takes weekly hours only where the posting gives them as hours", () => {
    const quote = "$1,000 per week";
    const withHours = verify({ quote, period: "week", min: 1000, hoursPerWeek: 37.5 }, `${quote}. A 37.5-hour work week.`);
    expect(withHours.pay?.hoursPerWeek).toBe(37.5);
    const noHours = verify({ quote, period: "week", min: 1000, hoursPerWeek: 40 }, `${quote}. Join our team of 40 engineers.`);
    expect(noHours.pay?.hoursPerWeek).toBeNull();
  });

  it("takes the currency from the pay passage only", () => {
    const source = "Pay: $30/hour\n\nRelocation: up to $2,000 USD";
    const { pay } = verify({ quote: "Pay: $30/hour", currency: "USD", period: "hour", min: 30 }, source);
    expect(pay).toMatchObject({ currency: "CAD", currencySource: "location" });
  });

  it("still rejects a quote where any one passage is made up", () => {
    const quote = "Compensation: $21 - $24/hour\nSigning bonus of $5,000";
    expect(verify({ quote, period: "hour", min: 21, max: 24 }, "Compensation: $21 - $24/hour").pay).toBeNull();
  });

  it("reads daily pay", () => {
    const quote = "200 RMB per day";
    const { pay } = verify({ quote, currency: "CNY", period: "day", min: 200 }, quote, { country: "China" });
    expect(pay).toMatchObject({ currency: "CNY", period: "day", hourlyCad: { min: 4.75, max: 4.75 } });
  });

  it("keeps a low stipend abroad rather than calling it a misreading", () => {
    const quote = "¥130,000 per month";
    const { pay } = verify({ quote, currency: "JPY", period: "month", min: 130000 }, quote, { country: "Japan" });
    expect(pay?.hourlyCad).toEqual({ min: 6.98, max: 6.98 });
  });

  it("gives a ceiling no hourly rate, since the pay could start anywhere below it", () => {
    const quote = "starting at minimum wage and up to $20/hour";
    const { pay } = verify({ quote, period: "hour", min: null, max: 20 }, quote);
    expect(pay).toMatchObject({ stated: true, min: null, max: 20, period: "hour", hourlyCad: null });
  });

  it("filters by a floor", () => {
    const quote = "$25+ per hour depending on experience";
    const { pay } = verify({ quote, period: "hour", min: 25, max: null }, quote);
    expect(pay).toMatchObject({ min: 25, max: 25, hourlyCad: { min: 25, max: 25 } });
  });

  it("returns nothing when the posting says nothing about pay", () => {
    expect(verify(null, "anything").pay).toBeNull();
  });
});

describe("verifyPay periods and currencies it used to miss", () => {
  it("reads an amount for a four-month term", () => {
    const quote = "$16,295 - $24,442 for a 4-month term (depending on experience)";
    const { pay } = verifyPay({ quote, period: "term", min: 16295, max: 24442 }, { source: quote, country: "Canada" });
    expect(pay).toMatchObject({ period: "term", periodSource: "stated", hourlyCad: { min: 25.46, max: 38.19 } });
  });

  it("reads New Taiwan dollars", () => {
    const quote = "Salary: NT$35,000 (for each month)";
    const { pay } = verifyPay({ quote, period: "month", min: 35000 }, { source: quote, country: "Taiwan" });
    expect(pay).toMatchObject({ currency: "TWD", currencySource: "stated", period: "month" });
  });

  it("takes the period from the sentence when the reading left it out", () => {
    const quote = "Stipend: 3000 RMB/month";
    const { pay } = verifyPay({ quote, period: null, min: 3000 }, { source: quote, country: "China" });
    expect(pay).toMatchObject({ period: "month", periodSource: "stated" });
  });

  it("leaves the period out when the sentence names more than one", () => {
    const quote = "$3,000 a month, 40 hours a week";
    const { pay } = verifyPay({ quote, period: null, min: 3000 }, { source: quote, country: "Canada" });
    expect(pay?.period).toBeNull();
  });
});

describe("verifyPay plausibility", () => {
  it("keeps a real stipend of under C$3 an hour", () => {
    const quote = "2500 CNY / Monthly";
    const { pay } = verifyPay({ quote, currency: "CNY", period: "month", min: 2500 }, { source: quote, country: "China" });
    expect(pay?.hourlyCad).toEqual({ min: 2.74, max: 2.74 });
  });

  it("still refuses an hourly figure read as monthly", () => {
    const quote = "$20 per hour, paid monthly";
    const { pay } = verifyPay({ quote, period: "month", min: 20 }, { source: quote, country: "Canada" });
    expect(pay?.hourlyCad).toBeNull();
  });
});
