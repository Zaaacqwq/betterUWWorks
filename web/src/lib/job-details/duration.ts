import type { PostingDetails, Requirement } from "./types";

// Whether a posting needs more than one work term comes from WaterlooWorks'
// own "Work Term Duration" field, which says it in fixed words ("8 month
// consecutive work term required", "... preferred", "2 work term commitment
// preferred"). The model can't do better: the sentence it would quote is the
// boilerplate UW adds to every such posting, which never says which.

const DURATION_KEY = "Work Term Duration";

export function durationRequirement(rawDetail: unknown): Requirement | null | undefined {
  if (!rawDetail || typeof rawDetail !== "object") return undefined;
  const value = (rawDetail as Record<string, unknown>)[DURATION_KEY];
  if (typeof value !== "string" || !value.trim()) return undefined;

  const text = value.trim();
  const multiTerm = /\b(?:8|12|16)[- ]?month|\b(?:2|two|3|three) work terms?\b|consecutive/i.test(text);
  if (!multiTerm) return null;
  return {
    kind: "consecutive_terms",
    summary: text.charAt(0).toUpperCase() + text.slice(1),
    value: null,
    required: !/\bpreferred\b/i.test(text),
    quote: text,
  };
}

// The field, when a posting has it, replaces whatever the model read about
// consecutive terms; without it, the model's reading stands.
export function withDurationRequirement(details: PostingDetails, rawDetail: unknown): PostingDetails {
  const fromField = durationRequirement(rawDetail);
  if (fromField === undefined) return details;
  const others = details.requirements.filter((r) => r.kind !== "consecutive_terms");
  return { ...details, requirements: fromField ? [...others, fromField] : others };
}
