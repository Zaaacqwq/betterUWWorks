import type { Capability } from "./types";

// When a posting's skill isn't one the student has, but is a more specific
// form of one they do (or the other way round), the student knows part of it:
// "Embedded Linux" for someone who knows Linux, "AWS Lambda" for someone who
// knows AWS, "Machine Learning" for someone who used Azure Machine Learning.
// That earns half credit. Only whole words count ("Java" is not in
// "JavaScript"), and a name that is only a field ("Analytics", "Testing") is
// never enough on its own.

export const RELATED_CREDIT = 0.5;

const FILLER = new Set(["a", "an", "and", "the", "of", "for", "with", "in", "on", "to", "or", "&"]);

// Words that name a field or a kind of thing rather than a technology: a name
// made only of these is too broad to earn credit for a more specific one.
const FIELD_WORDS = new Set([
  "programming", "language", "development", "software", "tool", "framework", "platform",
  "service", "system", "suite", "application", "data", "design", "analysis", "engineering",
  "management", "testing", "learning", "cloud", "web", "skill", "experience", "knowledge",
  "analytics", "security", "networking", "computing", "database", "infrastructure", "api",
  "concept", "principle", "method", "technique", "process", "solution", "technology",
]);

function stem(token: string): string {
  return token.length > 3 ? token.replace(/s$/, "") : token;
}

// Compared after stemming, so "analytics" is caught as well as "analytic".
const FIELD_STEMS = new Set([...FIELD_WORDS].map(stem));

// The list page scores every posting against the same resume, so the same
// names come up thousands of times.
const tokenCache = new Map<string, Set<string>>();

export function skillTokens(name: string): Set<string> {
  const cached = tokenCache.get(name);
  if (cached) return cached;
  const tokens = readTokens(name);
  tokenCache.set(name, tokens);
  return tokens;
}

function readTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/[\s/,()\-:]+/)
      .map((t) => stem(t.replace(/^\.+|\.+$/g, "")))
      .filter((t) => t && !FILLER.has(t))
  );
}

function strictSubset(small: Set<string>, big: Set<string>): boolean {
  if (small.size === 0 || small.size >= big.size) return false;
  // Every word is compared — "Machine Learning" stays two words, so it is not
  // in "Machine vision" — but the shorter name needs a word besides the field
  // ones: "Analytics" alone says nothing about Google Analytics.
  if ([...small].every((t) => FIELD_STEMS.has(t))) return false;
  // One short word ("Go", "R", "C") is too easily part of something else.
  if (small.size === 1 && [...small][0].length < 3) return false;
  for (const t of small) if (!big.has(t)) return false;
  return true;
}

export function areRelated(a: string, b: string): boolean {
  const ta = skillTokens(a);
  const tb = skillTokens(b);
  return strictSubset(ta, tb) || strictSubset(tb, ta);
}

// The student's capability a posting's skill is related to, if any — the one
// with the most weight when several are.
export function relatedCapability(
  jobSkill: string,
  capabilities: Capability[],
  weightOf: (c: Capability) => number
): Capability | null {
  let best: Capability | null = null;
  for (const cap of capabilities) {
    if (!areRelated(jobSkill, cap.name)) continue;
    if (!best || weightOf(cap) > weightOf(best)) best = cap;
  }
  return best;
}
