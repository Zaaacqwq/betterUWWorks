// What the model read out of a posting about pay and eligibility, after every
// part of it was checked against the posting's own words (see verify-pay.ts and
// verify-requirements.ts). Stored as jobs.ai_details.

export type PayPeriod = "hour" | "day" | "week" | "biweekly" | "month" | "year" | "term";

export interface TermRate {
  // The co-op work term the rate is for: 1 for a student's first term.
  term: number;
  amount: number;
}

export interface PayInfo {
  // False when the posting talks about pay without giving a figure
  // ("competitive", "based on the co-op average").
  stated: boolean;
  currency: string | null;
  // "stated": the posting names the currency. "location": it doesn't, and the
  // currency is the one where the job is.
  currencySource: "stated" | "location" | null;
  period: PayPeriod | null;
  // "stated": the posting's words give the period. "inferred": they don't, but
  // the figures leave no doubt — nobody is paid $22.50 a week, or $45,000 a month.
  periodSource: "stated" | "inferred" | null;
  min: number | null;
  max: number | null;
  // Rates by work term, when the posting gives a table of them.
  byTerm: TermRate[];
  hoursPerWeek: number | null;
  // The posting's words the figures were read from.
  quote: string;
  // min and max as Canadian dollars an hour, for filtering and sorting. Null
  // when the posting doesn't say enough to work it out honestly, or when two
  // separate readings of it came out different.
  hourlyCad: { min: number; max: number } | null;
}

export const REQUIREMENT_KINDS = [
  "citizenship",
  "security_clearance",
  "drivers_licence",
  "us_work_authorization",
  "language",
  "gpa",
  "min_work_term",
  "min_year",
  "program",
  "consecutive_terms",
] as const;

export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export interface Requirement {
  kind: RequirementKind;
  // A few words saying what is required, e.g. "Canadian citizen or permanent resident".
  summary: string;
  // Only for gpa (e.g. 3.0 or 80), min_work_term and min_year.
  value: number | null;
  // False for something the posting only prefers or calls an asset.
  required: boolean;
  // The posting's own sentence saying so.
  quote: string;
}

export interface PostingDetails {
  // Null when the posting says nothing about pay at all.
  pay: PayInfo | null;
  requirements: Requirement[];
}
