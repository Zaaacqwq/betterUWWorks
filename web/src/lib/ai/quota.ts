import { viewerOf } from "@/lib/auth/viewer";

// Model calls a friend can make in a day, on the owner's key. Counted in this
// process's memory: there is one server on one machine, and a restart handing
// everyone a fresh allowance is no great loss.
export type QuotaKind = "match" | "summary" | "resume" | "cover";

export const DAILY_LIMITS: Record<QuotaKind, number> = {
  match: 40,
  // Only a posting nobody has opened yet costs a call; the rest are cached.
  summary: 60,
  resume: 5,
  cover: 10,
};

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
export function takeAiQuota(request: Request, kind: QuotaKind, now = new Date()): Response | null {
  const viewer = viewerOf(request);
  if (viewer.isAdmin || !viewer.email) return null;

  const day = torontoDay(now);
  if (day !== usedDay) {
    used.clear();
    usedDay = day;
  }

  const key = `${viewer.email}|${kind}`;
  const count = used.get(key) ?? 0;
  if (count >= DAILY_LIMITS[kind]) {
    return Response.json(
      {
        success: false,
        error: `You've used today's ${DAILY_LIMITS[kind]} ${LABELS[kind]}. They reset at midnight.`,
      },
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
