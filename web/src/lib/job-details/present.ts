import type { ListedPay, PayPeriod, Requirement, RequirementKind, TermRate } from "./types";

// How a posting's pay and requirements read on screen. Pay is shown as the
// posting states it — its currency, its period — with the hourly C$ figure
// alongside only when that figure isn't already what it says.

const CURRENCY_PREFIX: Record<string, string> = {
  CAD: "$",
  USD: "US$",
  SGD: "S$",
  AUD: "A$",
  HKD: "HK$",
  TWD: "NT$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "CN¥",
  INR: "₹",
  CHF: "CHF ",
};

const PERIOD_SUFFIX: Record<PayPeriod, string> = {
  hour: "/hr",
  day: "/day",
  week: "/week",
  biweekly: "/2 weeks",
  month: "/month",
  year: "/year",
  term: "/term",
};

export function formatAmount(amount: number, currency: string | null): string {
  const prefix = currency ? (CURRENCY_PREFIX[currency] ?? `${currency} `) : "$";
  const cents = !Number.isInteger(amount) && amount < 1000;
  return `${prefix}${amount.toLocaleString("en-CA", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

export interface PayDisplay {
  // "US$65–75/hr", "$3,500–3,850/month", "Up to $20/hr", "Not stated"
  text: string;
  // "≈ C$90–104/hr" when the pay isn't already Canadian dollars an hour.
  hourlyCad: string | null;
  // The period came from the figures, not the posting's words.
  periodInferred: boolean;
  // The currency came from where the job is, not the posting's words.
  currencyAssumed: boolean;
}

function range(min: number | null, max: number | null, currency: string | null): string {
  if (min === null && max !== null) return `Up to ${formatAmount(max, currency)}`;
  if (min === null) return "";
  if (max === null || max === min) return formatAmount(min, currency);
  // "$20–25", not "$20–$25": the second figure shares the first's currency.
  return `${formatAmount(min, currency)}–${formatAmount(max, currency).replace(/^[^\d]+/, "")}`;
}

export function payDisplay(pay: ListedPay | null): PayDisplay | null {
  if (!pay) return null;
  if (!pay.stated) return { text: "Not stated", hourlyCad: null, periodInferred: false, currencyAssumed: false };

  const text = `${range(pay.min, pay.max, pay.currency)}${pay.period ? PERIOD_SUFFIX[pay.period] : ""}`;
  const alreadyHourlyCad = pay.currency === "CAD" && pay.period === "hour";
  const hourly = pay.hourlyCad && !alreadyHourlyCad
    ? `≈ C${range(Math.round(pay.hourlyCad.min), Math.round(pay.hourlyCad.max), "CAD")}/hr`
    : null;

  return {
    text,
    hourlyCad: hourly,
    periodInferred: pay.periodSource === "inferred",
    currencyAssumed: pay.currencySource === "location" && pay.currency !== "CAD",
  };
}

// The rate for a student going into this work term; past the table's last
// row, the last row.
export function rateForTerm(byTerm: TermRate[], term: number | null | undefined): TermRate | null {
  if (byTerm.length === 0 || !term) return null;
  return byTerm.find((r) => r.term === term) ?? (term > byTerm[byTerm.length - 1].term ? byTerm[byTerm.length - 1] : null);
}

// Requirements that decide whether a student can take the job at all come
// first; the rest describe who the posting is looking for.
const ELIGIBILITY: RequirementKind[] = [
  "citizenship",
  "security_clearance",
  "us_work_authorization",
  "drivers_licence",
  "consecutive_terms",
];

export interface RequirementChip {
  kind: RequirementKind;
  label: string;
  quote: string;
  required: boolean;
  eligibility: boolean;
}

export function requirementChips(requirements: Requirement[]): RequirementChip[] {
  return requirements
    .map((r) => ({
      kind: r.kind,
      label: r.summary,
      quote: r.quote,
      required: r.required,
      eligibility: ELIGIBILITY.includes(r.kind),
    }))
    .sort((a, b) => Number(b.eligibility) - Number(a.eligibility) || Number(b.required) - Number(a.required));
}

// The kinds a student can choose to hide from the list, in the order offered.
export const HIDEABLE_REQUIREMENTS: { kind: RequirementKind; label: string }[] = [
  { kind: "citizenship", label: "Citizenship or PR" },
  { kind: "security_clearance", label: "Security clearance" },
  { kind: "us_work_authorization", label: "US work authorization" },
  { kind: "drivers_licence", label: "Driver's licence or car" },
  { kind: "consecutive_terms", label: "8+ month commitment" },
];
