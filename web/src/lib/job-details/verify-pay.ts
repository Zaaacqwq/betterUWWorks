import { containsMention, foldText } from "@/lib/job-skills/verify";
import { containsNumber, numbersIn } from "./numbers";
import type { PayInfo, PayPeriod, TermRate } from "./types";

// The model reads the pay; nothing it says is stored on its word. Every figure
// has to be a number the posting writes, the period has to be one the posting's
// words name, and the currency is taken as stated only where the posting
// states it. Whatever fails is left out rather than guessed, so a posting can
// end up with its figures but no hourly rate — never with a wrong one.

const PERIOD_WORDS: Record<PayPeriod, RegExp> = {
  hour: /\b(?:hours?|hourly|hrs?)\b|\/\s*h\b|\bph\b|de l'heure|par heure/i,
  day: /\b(?:day|daily|per diem)\b|\/\s*day\b|par jour/i,
  week: /\b(?:weeks?|weekly|wk)\b|\/\s*w\b|par semaine|hebdomadaire/i,
  biweekly: /\bbi-?weekly\b|\bevery (?:two|2) weeks\b|\bper (?:two|2) weeks\b|aux deux semaines/i,
  month: /\b(?:months?|monthly|mo)\b|\/\s*mo\b|par mois|mensuel/i,
  year: /\b(?:years?|yearly|annual|annually|annum|yr)\b|\/\s*yr?\b|par an|annuel/i,
  term: /\b(?:per|for the|for a|for each|each|a|every|\/)\s*(?:(?:\d+|four|eight)[- ]?months?\s+)?(?:work\s*|co-?op\s*)?(?:terms?|semesters?|internship)\b|\bper-term\b/i,
};

const CURRENCY_WORDS: Record<string, RegExp> = {
  CAD: /\bCAD\b|\bC\$|\bCA\$|canadian dollars?/i,
  USD: /\bUSD\b|\bUS\s?\$|\bU\.S\.\s?\$|\bU\.?S\.? dollars?/i,
  SGD: /\bSGD\b|\bSG?\$/i,
  EUR: /\bEUR\b|€|\beuros?\b/i,
  GBP: /\bGBP\b|£/i,
  CHF: /\bCHF\b/i,
  AUD: /\bAUD\b|\bA\$/i,
  HKD: /\bHKD\b|\bHK\$/i,
  JPY: /\bJPY\b|¥/i,
  INR: /\bINR\b|₹/i,
  CNY: /\bCNY\b|\bRMB\b|元/i,
  TWD: /\bTWD\b|\bNT\$/i,
};

// Rough rates for comparing pay across countries, not for anyone's budget. The
// posting's own figures and currency are always kept alongside.
const TO_CAD: Record<string, number> = {
  CAD: 1,
  USD: 1.38,
  SGD: 1.05,
  EUR: 1.5,
  GBP: 1.75,
  CHF: 1.6,
  AUD: 0.9,
  HKD: 0.18,
  JPY: 0.0093,
  INR: 0.016,
  CNY: 0.19,
  TWD: 0.043,
};

const COUNTRY_CURRENCY: Record<string, string> = {
  canada: "CAD",
  "united states": "USD",
  usa: "USD",
  singapore: "SGD",
  "united kingdom": "GBP",
  germany: "EUR",
  france: "EUR",
  netherlands: "EUR",
  switzerland: "CHF",
  australia: "AUD",
  "hong kong": "HKD",
  japan: "JPY",
  india: "INR",
  china: "CNY",
  taiwan: "TWD",
};

const DEFAULT_HOURS_PER_WEEK = 40;
// A UW work term is four months, about sixteen weeks.
const WEEKS_PER_TERM = 16;
// Outside this, the reading is wrong, not the pay: it would be a monthly
// figure taken as hourly, or the other way round. The floor sits low enough
// for real stipends abroad (2,500 RMB a month is under C$3 an hour), while an
// hourly figure read as monthly still comes out at cents.
const PLAUSIBLE_HOURLY_CAD = { min: 2, max: 250 };

export interface PayVerification {
  pay: PayInfo | null;
  // What was dropped and why, for checking the extraction by hand.
  notes: string[];
}

const PERIODS = Object.keys(PERIOD_WORDS) as PayPeriod[];

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value.replace(/[,$\s]/g, "")))) {
    return Number(value.replace(/[,$\s]/g, ""));
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function currencyForCountry(country: string | null): string | null {
  if (!country) return null;
  return COUNTRY_CURRENCY[country.trim().toLowerCase()] ?? null;
}

// The currency the pay passage names. A passage naming two ("$75 USD an hour,
// $1,000 CAD relocation") is settled by the model's reading only if that
// reading is one of the two. Anything else falls back to where the job is.
function statedCurrency(claimed: unknown, passage: string): string | null {
  const code = typeof claimed === "string" ? claimed.trim().toUpperCase() : "";
  const named = Object.keys(CURRENCY_WORDS).filter((c) => CURRENCY_WORDS[c].test(passage));
  if (named.includes(code)) return code;
  return named.length === 1 ? named[0] : null;
}

export function hourlyRate(amount: number, period: PayPeriod, hoursPerWeek: number): number {
  switch (period) {
    case "hour":
      return amount;
    case "day":
      return amount / (hoursPerWeek / 5);
    case "week":
      return amount / hoursPerWeek;
    case "biweekly":
      return amount / 2 / hoursPerWeek;
    case "month":
      return (amount * 12) / 52 / hoursPerWeek;
    case "year":
      return amount / 52 / hoursPerWeek;
    case "term":
      return amount / WEEKS_PER_TERM / hoursPerWeek;
  }
}

// A period the figures alone settle, in dollar-like currencies: co-op pay of
// $12–$120 can only be by the hour, and $25,000 or more only by the year.
// Anything in between could be weekly, biweekly or monthly, so it is left unsaid.
const UNMISTAKABLE_PERIODS: { period: PayPeriod; min: number; max: number }[] = [
  { period: "hour", min: 12, max: 120 },
  { period: "year", min: 25_000, max: 300_000 },
];

export function inferPeriod(min: number, max: number, currency: string | null): PayPeriod | null {
  const rate = currency ? TO_CAD[currency] : undefined;
  if (rate === undefined || rate < 0.5 || rate > 2) return null;
  return UNMISTAKABLE_PERIODS.find((p) => min >= p.min && max <= p.max)?.period ?? null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toHourlyCad(
  min: number,
  max: number,
  period: PayPeriod | null,
  currency: string | null,
  hoursPerWeek: number | null
): PayInfo["hourlyCad"] {
  if (!period || !currency || !(currency in TO_CAD)) return null;
  const hours = hoursPerWeek ?? DEFAULT_HOURS_PER_WEEK;
  const low = hourlyRate(min, period, hours) * TO_CAD[currency];
  const high = hourlyRate(max, period, hours) * TO_CAD[currency];
  if (low < PLAUSIBLE_HOURLY_CAD.min || high > PLAUSIBLE_HOURLY_CAD.max) return null;
  return { min: round2(low), max: round2(high) };
}

function verifiedTermRates(raw: unknown, figures: Set<number>, notes: string[]): TermRate[] {
  if (!Array.isArray(raw)) return [];
  const rates: TermRate[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    const term = asNumber(record?.term);
    const amount = asNumber(record?.amount);
    if (term === null || amount === null || !Number.isInteger(term) || term < 1 || term > 8) {
      notes.push(`term rate ${JSON.stringify(entry)} is malformed`);
      continue;
    }
    if (!containsNumber(figures, amount)) {
      notes.push(`term ${term} amount ${amount} is not in the posting`);
      continue;
    }
    if (!rates.some((r) => r.term === term)) rates.push({ term, amount });
  }
  return rates.sort((a, b) => a.term - b.term);
}

// A posting that mentions pay in two places is quoted as two passages, one per
// line (or joined with "..."). Every line has to be in the posting. Lines that
// run on from each other within one paragraph there — a table quoted row by
// row — make one passage; a paragraph break always starts a new one.
export interface Passage {
  lines: string[];
  text: string;
}

function foldParagraphs(source: string): string {
  return foldText(source.replace(/\n\s*\n/g, " ¶ "));
}

export function quotePassages(quote: string, source: string): Passage[] | null {
  const folded = foldText(source);
  const paragraphs = foldParagraphs(source);
  const lines = quote
    .split(/\n|\.{3}|…/)
    .map((line) => line.trim())
    .filter(Boolean);
  const passages: Passage[] = [];
  for (const line of lines) {
    if (!containsMention(folded, line)) return null;
    const last = passages.at(-1);
    if (last && containsMention(paragraphs, `${last.text} ${line}`)) {
      last.lines.push(line);
      last.text = `${last.text} ${line}`;
    } else {
      passages.push({ lines: [line], text: line });
    }
  }
  return passages.length > 0 ? passages : null;
}

// Where the pay is read from: the sentence holding the most of the figures the
// model reported, within its passage. The figures have to come from that one
// sentence, so neither a stitched quote nor the next line ("Signing bonus of
// $5,000") can lend a figure to the pay. A table's rows are read from the
// passage as a whole, since each row holds one rate.
interface PaySource {
  sentence: string;
  passage: Passage;
}

function sentencesOf(passage: Passage): string[] {
  return passage.lines
    .flatMap((line) => line.split(/(?<=[.!?;])\s+(?=\S)/))
    .map((s) => s.trim())
    .filter(Boolean);
}

function paySource(passages: Passage[], claimed: number[]): PaySource {
  let best: PaySource = { sentence: passages[0].text, passage: passages[0] };
  let bestCount = -1;
  for (const passage of passages) {
    for (const sentence of sentencesOf(passage)) {
      const figures = numbersIn(sentence);
      const count = claimed.filter((n) => containsNumber(figures, n)).length;
      if (count > bestCount) [best, bestCount] = [{ sentence, passage }, count];
    }
  }
  return best;
}

// The period the pay sentence names; failing any there — a table row like
// "1 3500.00" — the one its passage names ("WT Monthly").
function statedPeriodFor(claimed: PayPeriod | null, { sentence, passage }: PaySource): PayPeriod | null {
  const inSentence = PERIODS.filter((p) => PERIOD_WORDS[p].test(sentence));
  // The model left the period out, but the sentence names exactly one.
  if (!claimed) return inSentence.length === 1 ? inSentence[0] : null;
  if (inSentence.length > 0) return inSentence.includes(claimed) ? claimed : null;
  return PERIOD_WORDS[claimed].test(passage.text) ? claimed : null;
}

// Weekly hours count only where the posting gives them as hours: "35 hours
// per week", "a 37.5-hour work week" — not any number that happens to match.
function statesHours(source: string, hours: number): boolean {
  const figure = String(hours).replace(".", "\\.");
  return new RegExp(`(?<![\\d.])${figure}(?:\\.0+)?\\s*-?\\s*(?:hours?|hrs?)\\b`, "i").test(source);
}

export interface PayContext {
  // All the posting's text, which every quoted passage must come from.
  source: string;
  // The country the job is in, for a currency the posting leaves unsaid.
  country: string | null;
}

export function verifyPay(raw: unknown, context: PayContext): PayVerification {
  const notes: string[] = [];
  if (raw === null || raw === undefined) return { pay: null, notes };
  const record = asRecord(raw);
  if (!record) return { pay: null, notes: ["pay is not an object"] };

  const quote = typeof record.quote === "string" ? record.quote.trim() : "";
  const passages = quote ? quotePassages(quote, context.source) : null;
  if (!passages) return { pay: null, notes: [`quote not in posting: ${quote.slice(0, 80)}`] };

  const claimed = [record.min, record.max, ...(Array.isArray(record.byTerm) ? record.byTerm.map((r) => asRecord(r)?.amount) : [])]
    .map(asNumber)
    .filter((n): n is number => n !== null);
  const where = paySource(passages, claimed);
  const figures = numbersIn(where.sentence);
  const byTerm = verifiedTermRates(record.byTerm, numbersIn(where.passage.text), notes);

  const keepFigure = (value: unknown, label: string): number | null => {
    const n = asNumber(value);
    if (n === null) return null;
    if (n <= 0 || !containsNumber(figures, n)) {
      notes.push(`${label} ${n} is not in the pay sentence`);
      return null;
    }
    return n;
  };
  let min = keepFigure(record.min, "min");
  let max = keepFigure(record.max, "max");
  if (byTerm.length > 0) {
    const amounts = byTerm.map((r) => r.amount);
    min ??= Math.min(...amounts);
    max ??= Math.max(...amounts);
  }
  // "$25+" is a floor, and a fair figure to filter by. "Up to $20" is only a
  // ceiling: the pay could start anywhere below it, so it gets no hourly rate.
  const ceilingOnly = min === null && max !== null;
  max ??= min;
  if (min !== null && max !== null && min > max) [min, max] = [max, min];

  const claimedPeriod = PERIODS.find((p) => p === record.period) ?? null;
  const statedPeriod = statedPeriodFor(claimedPeriod, where);
  if (claimedPeriod && !statedPeriod) notes.push(`period "${claimedPeriod}" is not in the pay sentence`);

  const hoursClaimed = asNumber(record.hoursPerWeek);
  const hoursPerWeek =
    hoursClaimed !== null && hoursClaimed >= 10 && hoursClaimed <= 60 && statesHours(context.source, hoursClaimed)
      ? hoursClaimed
      : null;

  const stated = max !== null;
  const named = statedCurrency(record.currency, where.passage.text);
  const currency = stated ? (named ?? currencyForCountry(context.country)) : null;
  const currencySource = !currency ? null : named ? "stated" : "location";

  const inferred = stated && !statedPeriod ? inferPeriod(min ?? max!, max!, currency) : null;
  const period = stated ? (statedPeriod ?? inferred) : null;
  const periodSource = !period ? null : statedPeriod ? "stated" : "inferred";

  return {
    pay: {
      stated,
      currency,
      currencySource,
      period,
      periodSource,
      min,
      max,
      byTerm,
      hoursPerWeek,
      quote,
      hourlyCad: stated && !ceilingOnly ? toHourlyCad(min!, max!, period, currency, hoursPerWeek) : null,
    },
    notes,
  };
}
