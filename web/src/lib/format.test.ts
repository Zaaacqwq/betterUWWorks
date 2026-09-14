import { describe, expect, it } from "vitest";
import { deadlineInfo, matchTone, payTier } from "./format";

describe("payTier", () => {
  it("is grey under $20, green to $30, amber to $60, red from $60", () => {
    expect(payTier(18, null)).toBe("under");
    expect(payTier(20, null)).toBe("low");
    expect(payTier(29.99, null)).toBe("low");
    expect(payTier(30, null)).toBe("mid");
    expect(payTier(59.99, null)).toBe("mid");
    expect(payTier(60, null)).toBe("high");
  });

  it("judges a range by its middle", () => {
    expect(payTier(20, 40)).toBe("mid"); // middle 30
    expect(payTier(50, 70)).toBe("high"); // middle 60
    expect(payTier(18, 24)).toBe("low"); // middle 21
    expect(payTier(16, 22)).toBe("under"); // middle 19
  });

  it("has nothing to say without pay", () => {
    expect(payTier(null, null)).toBeNull();
  });
});

describe("matchTone", () => {
  it("goes green, amber, red, then grey", () => {
    expect(matchTone(92)).toBe("good");
    expect(matchTone(80)).toBe("good");
    expect(matchTone(79)).toBe("fair");
    expect(matchTone(60)).toBe("fair");
    expect(matchTone(59)).toBe("poor");
    expect(matchTone(40)).toBe("poor");
    expect(matchTone(39)).toBe("neutral");
  });
});

describe("deadlineInfo away and tone", () => {
  const now = new Date(2026, 8, 14, 10, 0); // Sep 14, 10:00 local
  const at = (month: number, day: number, hour = 9) => new Date(2026, month, day, hour).toISOString();

  it("says today and tomorrow in words, and counts days after that", () => {
    expect(deadlineInfo(at(8, 14, 23), now)?.away).toBe("Today");
    expect(deadlineInfo(at(8, 15), now)?.away).toBe("Tomorrow");
    expect(deadlineInfo(at(8, 18), now)?.away).toBe("4 days away");
  });

  it("is red within three days, amber within a week, green after", () => {
    expect(deadlineInfo(at(8, 17), now)?.tone).toBe("poor"); // 3 days
    expect(deadlineInfo(at(8, 18), now)?.tone).toBe("fair"); // 4 days
    expect(deadlineInfo(at(8, 21), now)?.tone).toBe("fair"); // 7 days
    expect(deadlineInfo(at(8, 22), now)?.tone).toBe("good"); // 8 days
  });

  it("goes grey once closed", () => {
    const closed = deadlineInfo(at(8, 13), now);
    expect(closed?.away).toBe("Closed");
    expect(closed?.tone).toBe("neutral");
  });
});
