import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIEWER_EMAIL_HEADER } from "@/lib/auth/viewer";
import { DAILY_LIMITS, resetAiQuotaForTests, takeAiQuota } from "./quota";

function req(email?: string): Request {
  return new Request("http://127.0.0.1:3000/api/resume/extract", {
    headers: email ? { [VIEWER_EMAIL_HEADER]: email } : {},
  });
}

const NOON = new Date("2026-09-14T16:00:00Z"); // 12:00 in Waterloo

beforeEach(() => {
  resetAiQuotaForTests();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
});
afterEach(() => vi.unstubAllEnvs());

describe("takeAiQuota", () => {
  it("allows a friend up to the daily limit, then refuses with 429", async () => {
    for (let i = 0; i < DAILY_LIMITS.resume; i++) {
      expect(takeAiQuota(req("friend@uwaterloo.ca"), "resume", NOON)).toBeNull();
    }
    const refusal = takeAiQuota(req("friend@uwaterloo.ca"), "resume", NOON);
    expect(refusal?.status).toBe(429);
    expect((await refusal?.json()).error).toMatch(/reset at midnight/);
  });

  it("counts each friend and each kind separately", () => {
    for (let i = 0; i < DAILY_LIMITS.resume; i++) takeAiQuota(req("a@uwaterloo.ca"), "resume", NOON);
    expect(takeAiQuota(req("b@uwaterloo.ca"), "resume", NOON)).toBeNull();
    expect(takeAiQuota(req("a@uwaterloo.ca"), "match", NOON)).toBeNull();
  });

  it("hands out a fresh allowance after midnight in Waterloo, not UTC", () => {
    for (let i = 0; i < DAILY_LIMITS.resume; i++) takeAiQuota(req("a@uwaterloo.ca"), "resume", NOON);
    // 23:30 in Waterloo is already the next day in UTC: still the same allowance.
    const lateEvening = new Date("2026-09-15T03:30:00Z");
    expect(takeAiQuota(req("a@uwaterloo.ca"), "resume", lateEvening)?.status).toBe(429);
    const nextMorning = new Date("2026-09-15T12:00:00Z");
    expect(takeAiQuota(req("a@uwaterloo.ca"), "resume", nextMorning)).toBeNull();
  });

  it("never limits the owner or requests made on the machine itself", () => {
    for (let i = 0; i < DAILY_LIMITS.resume + 3; i++) {
      expect(takeAiQuota(req("owner@example.com"), "resume", NOON)).toBeNull();
      expect(takeAiQuota(req(), "resume", NOON)).toBeNull();
    }
  });
});
