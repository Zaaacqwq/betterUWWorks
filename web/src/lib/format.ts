export function formatPay(min: number | null, max: number | null): string | null {
  if (min == null) return null;
  if (max != null && max !== min) {
    return `$${Math.round(min)}–${Math.round(max)}`;
  }
  return `$${Math.round(min)}`;
}

// WaterlooWorks spells durations out ("8 month consecutive work term
// required"); the list only has room for the number of months.
export function shortDuration(duration: string | null): string | null {
  if (!duration) return null;
  const match = duration.match(/(\d+(?:\s*(?:or|to|-|–)\s*\d+)?)\s*month/i);
  return match ? `${match[1].replace(/\s*(-|–)\s*/, "–")} mo` : null;
}

export type Tone = "good" | "fair" | "poor" | "neutral";

export function ratingTone(rating: number): Tone {
  if (rating >= 8.5) return "good";
  if (rating >= 7) return "fair";
  return "poor";
}

// Green a strong match, amber a fair one, red a weak one; grey below that,
// where the posting is simply for someone else.
export function matchTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "neutral";
}

// C$ an hour, judged at the middle of the posting's range. Under $20 is grey.
// Green is ordinary co-op pay ($20–30, 1,120 of 1,816 postings with pay in
// Sep 2026), amber is well above it, and red is kept for pay that is
// genuinely high — $60 and up, 110 postings — as the owner reads pay.
export type PayTier = "under" | "low" | "mid" | "high";

export const PAY_TIER_CUTS = { floor: 20, mid: 30, high: 60 } as const;

export function payTier(min: number | null, max: number | null): PayTier | null {
  if (min == null) return null;
  const mid = (min + (max ?? min)) / 2;
  if (mid < PAY_TIER_CUTS.floor) return "under";
  if (mid < PAY_TIER_CUTS.mid) return "low";
  if (mid < PAY_TIER_CUTS.high) return "mid";
  return "high";
}

export const PAY_TIER_TEXT: Record<PayTier, string> = {
  under: "text-steel",
  low: "text-good",
  mid: "text-fair",
  high: "text-poor",
};

export const TONE_TEXT: Record<Tone, string> = {
  good: "text-good",
  fair: "text-fair",
  poor: "text-poor",
  neutral: "text-steel",
};

export interface DeadlineInfo {
  /** "Jun 5" */
  date: string;
  /** Whole calendar days from today; negative once it has passed. */
  days: number;
  /** "Closes tomorrow", "Closes Jun 5", "Closed" */
  label: string;
  /** "in 4 days", "today", "closed" */
  relative: string;
  /** "Today", "Tomorrow", "4 days away", "Closed" */
  away: string;
  /** Red within three days, amber within a week, green after; grey once closed. */
  tone: Tone;
  urgent: boolean;
  closed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const URGENT_DAYS = 2;
const SOON_DAYS = 3;
const WEEK_DAYS = 7;

function deadlineTone(days: number, closed: boolean): Tone {
  if (closed) return "neutral";
  if (days <= SOON_DAYS) return "poor";
  if (days <= WEEK_DAYS) return "fair";
  return "good";
}

export function deadlineInfo(deadlineAt: string | null, now: Date = new Date()): DeadlineInfo | null {
  if (!deadlineAt) return null;
  const at = new Date(deadlineAt);
  if (isNaN(at.getTime())) return null;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY_MS);
  const closed = at.getTime() < now.getTime();
  const date = at.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    ...(at.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });

  let label: string;
  let relative: string;
  if (closed) {
    label = "Closed";
    relative = "closed";
  } else if (days === 0) {
    label = "Closes today";
    relative = "today";
  } else if (days === 1) {
    label = "Closes tomorrow";
    relative = "tomorrow";
  } else if (days <= URGENT_DAYS) {
    label = `Closes in ${days} days`;
    relative = `in ${days} days`;
  } else {
    label = `Closes ${date}`;
    relative = `in ${days} days`;
  }

  const away = closed ? "Closed" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days away`;

  return {
    date,
    days,
    label,
    relative,
    away,
    tone: deadlineTone(days, closed),
    urgent: !closed && days <= URGENT_DAYS,
    closed,
  };
}
