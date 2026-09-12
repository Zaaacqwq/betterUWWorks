import { containsMention, foldText } from "@/lib/job-skills/verify";
import { containsNumber, numbersIn } from "./numbers";
import { REQUIREMENT_KINDS, type Requirement, type RequirementKind } from "./types";

// Each requirement the model reports must come with the posting's own sentence,
// and that sentence must be about the kind of requirement it was filed under:
// a sentence filed as "citizenship" has to mention citizens or permanent
// residents. Being "legally eligible to work in Canada", which every co-op
// student is, therefore can never become a citizenship requirement.
const KIND_WORDS: Record<RequirementKind, RegExp> = {
  citizenship: /citizen|permanent resident|\bPR\b|citoyen|résident permanent/i,
  security_clearance: /clearance|reliability|security (?:check|screening)|background (?:check|screening)|criminal|police|vulnerable sector|enhanced reliability|cote de fiabilité/i,
  drivers_licence: /licen[cs]e|driv(?:er|ing)|vehicle|\bcar\b|transportation|permis de conduire/i,
  us_work_authorization: /visa|work permit|authori[sz]|eligib\w* to work in the (?:U\.?S|United States|USA)|\bJ-?1\b|\bH-?1B\b|\bCPT\b|\bOPT\b|sponsor/i,
  language: /french|bilingual|english|spanish|mandarin|cantonese|german|japanese|korean|language|français|bilingue/i,
  gpa: /\bgpa\b|cgpa|average|grade|\d\s*%|moyenne/i,
  min_work_term: /\bterm\b|co-?op|work term|stage/i,
  min_year: /\byears?\b|\b\d\s*[AB]\b|level|année/i,
  program: /program|enrol|pursuing|studying|studies|education|degree|diploma|bachelor|master|ph\.?d|undergraduate|graduate|major|faculty|discipline|student(?:s)? (?:in|of|from)|engineer|science|math|computer|business|arts\b|analytics|environment|health|accounting|finance|économie|génie/i,
  consecutive_terms: /consecutive|8[- ]?month|eight[- ]month|two (?:work )?terms|2 (?:work )?terms|12[- ]?month|16[- ]?month|back[- ]to[- ]back/i,
};

const VALUE_RANGE: Partial<Record<RequirementKind, { min: number; max: number }>> = {
  // A GPA on a 4- or 4.33-point scale, or an average in percent.
  gpa: { min: 1, max: 100 },
  min_work_term: { min: 1, max: 6 },
  min_year: { min: 1, max: 5 },
};

const MAX_SUMMARY_LENGTH = 80;

// Whether the posting's own sentence only prefers it. The model sometimes
// files "8 month consecutive work term preferred" as required; the sentence
// settles it, unless it also says something is required.
const PREFERS = /\b(?:preferred|preferably|an? (?:asset|plus|bonus)|nice to have|desirable|advantageous|considered an asset|would be an asset)\b/i;
const REQUIRES = /\b(?:required|requires?|must|mandatory|necessary|need to|needs to)\b/i;

export function onlyPreferred(quote: string): boolean {
  return PREFERS.test(quote) && !REQUIRES.test(quote);
}

export interface RequirementVerification {
  requirements: Requirement[];
  notes: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function verifiedValue(kind: RequirementKind, raw: unknown, quote: string): number | null | "invalid" {
  const range = VALUE_RANGE[kind];
  if (!range) return null;
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  if (!Number.isFinite(value)) return null;
  if (value < range.min || value > range.max) return "invalid";
  // "Third-year" and "3B" both say 3; a number the sentence doesn't hold is
  // only trusted if the sentence spells it out.
  if (containsNumber(numbersIn(quote), value)) return value;
  const ordinals = ["first", "second", "third", "fourth", "fifth", "sixth"];
  return new RegExp(`\\b${ordinals[value - 1] ?? "\\0"}\\b`, "i").test(quote) ? value : "invalid";
}

function judge(entry: unknown, folded: string): Requirement | string {
  const record = asRecord(entry);
  if (!record) return "malformed entry";

  const kind = REQUIREMENT_KINDS.find((k) => k === record.kind);
  if (!kind) return `unknown kind ${JSON.stringify(record.kind)}`;

  const quote = typeof record.quote === "string" ? record.quote.trim() : "";
  if (!quote || !containsMention(folded, quote)) return `${kind}: quote not in posting: ${quote.slice(0, 80)}`;
  if (!KIND_WORDS[kind].test(quote)) return `${kind}: quote is not about ${kind}: ${quote.slice(0, 80)}`;

  // A number the sentence doesn't bear out is dropped, not the requirement: a
  // posting asking for "an average of 75%" still asks for an average even if
  // the model wrote it down as 3.0.
  const value = verifiedValue(kind, record.value, quote);

  const summary = typeof record.summary === "string" ? record.summary.trim().slice(0, MAX_SUMMARY_LENGTH) : "";
  return {
    kind,
    summary: summary || quote.slice(0, MAX_SUMMARY_LENGTH),
    value: value === "invalid" ? null : value,
    required: record.required !== false && !onlyPreferred(quote),
    quote,
  };
}

// One entry per kind. A posting often says the same thing twice — "8 month
// consecutive work term required" in the duration field and again in the
// special requirements — and where one says required and the other preferred,
// required wins.
export function mergeRequirements(lists: Requirement[][]): Requirement[] {
  const byKind = new Map<RequirementKind, Requirement>();
  for (const requirement of lists.flat()) {
    const existing = byKind.get(requirement.kind);
    if (!existing || (requirement.required && !existing.required)) {
      byKind.set(requirement.kind, requirement);
    }
  }
  return REQUIREMENT_KINDS.flatMap((kind) => byKind.get(kind) ?? []);
}

export function verifyRequirements(raw: unknown, source: string): RequirementVerification {
  const notes: string[] = [];
  if (!Array.isArray(raw)) {
    return { requirements: [], notes: raw == null ? [] : ["requirements is not an array"] };
  }

  const folded = foldText(source);
  const verified: Requirement[] = [];
  for (const entry of raw) {
    const verdict = judge(entry, folded);
    if (typeof verdict === "string") notes.push(verdict);
    else verified.push(verdict);
  }
  return { requirements: mergeRequirements([verified]), notes };
}
