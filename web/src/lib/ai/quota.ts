import { viewerOf } from "@/lib/auth/viewer";
import { readSetting } from "@/lib/settings";

// Model calls a friend can make in a day, on the owner's key. Counted in this
// process's memory: there is one server on one machine, and a restart handing
// everyone a fresh allowance is no great loss.
export type QuotaKind = "match" | "summary" | "resume" | "cover";

// What the allowances are unless the owner has changed them at /admin.
export const DEFAULT_LIMITS: Record<QuotaKind, number> = {
  match: 50,
  // Only a posting nobody has opened yet costs a call; the rest are cached.
  summary: 60,
  resume: 5,
  cover: 50,
};

// Full re-checks of a resume against every open posting, per student per day.
export const DEFAULT_FULL_CHECKS = 3;

export const LIMITS_KEY = "ai-limits";

export interface AiLimits extends Record<QuotaKind, number> {
  fullChecks: number;
}

export async function aiLimits(): Promise<AiLimits> {
  const stored = await readSetting<Partial<AiLimits>>(LIMITS_KEY, {});
  return { ...DEFAULT_LIMITS, fullChecks: DEFAULT_FULL_CHECKS, ...stored };
}

const LABELS: Record<QuotaKind, string> = {
  match: "application advice",
  summary: "posting summaries",
  resume: "resume readings",
  cover: "cover letters",
};

// Allowances turn over at midnight in Waterloo, not UTC.
const TIME_ZONE = "America/Toronto";

const used = new Map<string, number>();
let usedDay = "";

export function torontoDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

// Spends one call from the viewer's allowance. Answers with the refusal once
// it is used up, or null when the call may go ahead. The owner, and requests
// made on the machine itself, are not counted.
export async function takeAiQuota(request: Request, kind: QuotaKind, now = new Date()): Promise<Response | null> {
  const viewer = viewerOf(request);
  if (viewer.isAdmin || !viewer.email) return null;
  const limit = (await aiLimits())[kind];

  const day = torontoDay(now);
  if (day !== usedDay) {
    used.clear();
    usedDay = day;
  }

  const key = `${viewer.email}|${kind}`;
  const count = used.get(key) ?? 0;
  if (count >= limit) {
    return Response.json(
      { success: false, error: `You've used today's ${limit} ${LABELS[kind]}. They reset at midnight.` },
      { status: 429 }
    );
  }
  used.set(key, count + 1);
  return null;
}

export function resetAiQuotaForTests(): void {
  used.clear();
  usedDay = "";
}
