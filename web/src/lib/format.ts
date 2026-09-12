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

export function matchTone(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 60) return "fair";
  return "neutral";
}

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
  urgent: boolean;
  closed: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const URGENT_DAYS = 2;

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

  return { date, days, label, relative, urgent: !closed && days <= URGENT_DAYS, closed };
}
