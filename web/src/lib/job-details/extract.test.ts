import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PayInfo } from "./types";

const generateText = vi.fn();
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/provider", () => ({ models: { fast: "model" }, FAST_OPTIONS: {} }));

const { agreedPay, extractPostingDetails } = await import("./extract");

const posting = {
  jobId: "1",
  title: "Analyst",
  location: "Toronto",
  rawDetail: {
    "Compensation and Benefits": "Compensation: $25 - $30/hour. Signing bonus of $5,000.",
    "Special Job Requirements": "Applicants must be Canadian citizens or permanent residents.",
    "Job - Country": "Canada",
  },
};

const pay = (min: number, max: number) => ({
  quote: "Compensation: $25 - $30/hour",
  currency: null,
  period: "hour",
  min,
  max,
  byTerm: [],
  hoursPerWeek: null,
});
const citizenship = {
  kind: "citizenship",
  summary: "Canadian citizen or PR",
  value: null,
  required: true,
  quote: "Applicants must be Canadian citizens or permanent residents.",
};
const reply = (payValue: unknown, requirements: unknown[] = []) => ({
  text: JSON.stringify({ pay: payValue, requirements }),
});

function replies(...texts: { text: string }[]) {
  let call = 0;
  generateText.mockImplementation(async () => texts[Math.min(call++, texts.length - 1)]);
}

async function payOf() {
  const result = await extractPostingDetails(posting);
  if (result.kind !== "extracted") throw new Error("expected an extraction");
  return result.reading.details;
}

describe("extractPostingDetails", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("stores pay two readings agree on, with its hourly rate", async () => {
    replies(reply(pay(25, 30), [citizenship]));
    const details = await payOf();
    expect(details.pay).toMatchObject({ min: 25, max: 30, hourlyCad: { min: 25, max: 30 } });
    expect(details.requirements.map((r) => r.kind)).toEqual(["citizenship"]);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("asks a third reading when two disagree, and goes with the majority", async () => {
    replies(reply(pay(25, 30)), reply(null), reply(pay(25, 30)));
    const details = await payOf();
    expect(generateText).toHaveBeenCalledTimes(3);
    expect(details.pay).toMatchObject({ min: 25, max: 30, hourlyCad: { min: 25, max: 30 } });
  });

  it("drops figures only one reading found when the others found none", async () => {
    replies(reply(null), reply(pay(25, 30)), reply(null));
    expect((await payOf()).pay).toBeNull();
  });

  it("pools requirements across readings", async () => {
    replies(reply(null, [citizenship]), reply(null, []));
    expect((await payOf()).requirements).toHaveLength(1);
  });

  it("fails, to be tried again, when a reading fails", async () => {
    generateText.mockRejectedValue(new Error("gateway down"));
    await expect(extractPostingDetails(posting)).rejects.toThrow("gateway down");
  });

  it("asks nothing about a posting without detail", async () => {
    const result = await extractPostingDetails({ ...posting, rawDetail: null });
    expect(result).toEqual({ kind: "no-source" });
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("agreedPay", () => {
  const stated = (min: number, max: number): PayInfo => ({
    stated: true,
    currency: "CAD",
    currencySource: "location",
    period: "hour",
    periodSource: "stated",
    min,
    max,
    byTerm: [],
    hoursPerWeek: null,
    quote: "",
    hourlyCad: { min, max },
  });

  it("is unsettled while two readings disagree", () => {
    expect(agreedPay([stated(25, 30), stated(20, 30)])).toEqual({ pay: null, settled: false });
    expect(agreedPay([stated(25, 30), null])).toEqual({ pay: null, settled: false });
  });

  it("keeps figures but no hourly rate when three readings all differ", () => {
    const { pay, settled } = agreedPay([stated(25, 30), stated(20, 30), null]);
    expect(settled).toBe(true);
    expect(pay).toMatchObject({ min: 25, max: 30, hourlyCad: null });
  });
});
