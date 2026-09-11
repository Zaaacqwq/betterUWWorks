import { normalizeSkill } from "@/lib/resume/skill-utils";

// The model is asked to return each skill with the words of the posting that
// name it. Nothing it says is taken on trust: a skill is kept only when those
// words really are in the posting, and its name is kept only when those words
// justify it. This is what stops an extraction from inventing a requirement —
// a posting that says "Python" never comes back as also wanting Django.

export interface SkillCandidate {
  skill: string;
  mention: string;
}

export type SkillVerdict =
  | { kind: "kept"; skill: string; mention: string }
  // The words are in the posting, but the model's name for them says more than
  // they do ("React Native" where the posting says "React"), so the posting's
  // own words become the name.
  | { kind: "renamed"; skill: string; mention: string; proposed: string }
  | { kind: "rejected"; skill: string; mention: string; reason: string };

export interface VerifiedSkills {
  skills: string[];
  verdicts: SkillVerdict[];
}

// Words that say nothing about which skill is meant, so sharing one does not
// make two names the same skill: "Data Analysis" is not "Data Visualization".
const INDISTINCT_TOKENS = new Set([
  "a", "an", "and", "the", "of", "for", "with", "in", "on", "to", "or",
  "microsoft", "ms", "google", "amazon", "apache", "adobe", "autodesk",
  "atlassian", "ibm", "oracle", "sap",
  "programming", "language", "languages", "development", "software", "tool",
  "tools", "framework", "frameworks", "platform", "platforms", "service",
  "services", "system", "systems", "suite", "application", "applications",
  "data", "design", "analysis", "engineering", "management", "testing",
  "learning", "cloud", "web", "skills", "skill", "experience", "knowledge",
]);

// Kept out even when the posting names them. The prompt already says so; this
// is the backstop for when the model does not listen.
const NOT_SKILLS = new Set([
  "communication", "communication skills", "teamwork", "team player",
  "leadership", "problem solving", "problem-solving", "critical thinking",
  "attention to detail", "time management", "organization", "organizational skills",
  "interpersonal skills", "collaboration", "adaptability", "creativity",
  "english", "french", "bilingual", "mandarin", "spanish",
  "programming", "coding", "software", "technology", "computer skills",
  "technical skills", "programming skills", "data", "computers",
]);

const MAX_SKILL_LENGTH = 60;

// Evens out what differs between copies of the same words — typographic quotes
// and dashes, line breaks — but keeps case, which checkMention needs.
export function foldText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(text: string): string {
  return foldText(text).toLowerCase();
}

// "+" and "#" count as part of a word so that the "C" in "C++" and the "F" in
// "F#" are not mistaken for mentions of C and F.
const WORD_CHAR = /[a-z0-9+#]/i;

function mentionPattern(mention: string): RegExp | null {
  const needle = foldText(mention);
  if (!needle) return null;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = WORD_CHAR.test(needle[0]) ? "(?<![a-z0-9+#])" : "";
  const end = WORD_CHAR.test(needle[needle.length - 1]) ? "(?![a-z0-9+#])" : "";
  return new RegExp(`${start}${escaped}${end}`, "gi");
}

// Skill names that are also everyday words, each with the words that follow it
// when it is being used as the word. Written in lower case they are almost
// always the word — "excel in a fast-paced team" — so they only count where
// the posting writes them as a name: capitalised or in a list. Capitals alone
// prove nothing at the start of a sentence or heading ("Next Steps: apply",
// "Access to mentors"), which is what the following words are for.
interface EverydayWord {
  // What follows the word when it is being used as the word.
  followedBy: RegExp;
  // Words nearby that give the everyday sense away even in a list: "Spring"
  // among the other seasons is a term, not the framework.
  nearby?: RegExp;
}

const NO_TELL = /^(?!)/;
const everydayWord = (followedBy: RegExp, nearby?: RegExp): EverydayWord => ({ followedBy, nearby });
const NEARBY_CHARS = 30;

const EVERYDAY_WORDS = new Map<string, EverydayWord>([
  ["next", everydayWord(/^(?:generation|gen|steps?|years?|weeks?|months?|terms?|levels?|phases?|few|chapter|stages?|rounds?|big|wave|days?|time|up|to|in|,)/)],
  ["node", everydayWord(NO_TELL)],
  ["express", everydayWord(/^(?:interest|your|yourself|an?|written|verbal|consent)\b/)],
  ["go", everydayWord(/^(?:to|beyond|above|through|the|out|live|further|-)/)],
  ["spring", everydayWord(/^(?:\d|terms?|semesters?|session|break|season)/, /\b(?:winter|summer|fall|autumn)\b/i)],
  ["swift", everydayWord(/^(?:response|action|turnaround|pace)\b/)],
  ["rust", everydayWord(NO_TELL)],
  ["access", everydayWord(/^(?:to|for|the|a|an|our|your|will)\b/)],
  ["word", everydayWord(/^(?:of|choice|count|limit)\b/)],
  ["excel", everydayWord(/^(?:in|at|as|within|while|by|when)\b/)],
  ["outlook", everydayWord(/^(?:on|for)\b/)],
  ["teams", everydayWord(/^(?:of|to|that|who|across|are|will|work|in|at|with)\b/)],
  ["office", everydayWord(/^(?:environment|space|setting|hours|locations?|in|at|is|-)/)],
  ["rest", everydayWord(/^(?:of|assured)\b/)],
  ["dart", everydayWord(NO_TELL)],
  ["flask", everydayWord(NO_TELL)],
  ["shell", everydayWord(/^(?:companies|company|canada|station|out)\b/)],
  ["sketch", everydayWord(/^(?:out|of|a|an|ideas)\b/)],
  ["unity", everydayWord(/^(?:of|in)\b/)],
  ["ruby", everydayWord(NO_TELL)],
  ["julia", everydayWord(NO_TELL)],
  ["salt", everydayWord(NO_TELL)],
  ["chef", everydayWord(NO_TELL)],
  ["puppet", everydayWord(NO_TELL)],
  ["ant", everydayWord(NO_TELL)],
]);

export type MentionCheck = "found" | "absent" | "everyday-word";

interface Occurrence {
  start: number;
  end: number;
}

function findMention(foldedSource: string, mention: string): Occurrence[] {
  const pattern = mentionPattern(mention);
  if (!pattern) return [];
  return [...foldedSource.matchAll(pattern)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
}

// Whether an everyday word is being used as a name at this spot. In a list
// it is ("React, Next, Node", "(word, excel, outlook)"). Otherwise the word
// after it can give away the everyday sense ("Next steps", "Access to",
// "excel in"), and failing that, capitals mark a name.
function isWrittenAsName(foldedSource: string, { start, end }: Occurrence, everyday: EverydayWord): boolean {
  const around = foldedSource.slice(Math.max(0, start - NEARBY_CHARS), end + NEARBY_CHARS);
  if (everyday.nearby?.test(around)) return false;

  const before = foldedSource.slice(0, start).trimEnd().slice(-1);
  const following = foldedSource.slice(end).trimStart();
  if (/[,/(&;]/.test(before)) return true;
  if (everyday.followedBy.test(following.toLowerCase())) return false;

  const first = foldedSource[start];
  if (first !== first.toLowerCase()) return true;
  return /^[,/)&;]/.test(following);
}

export function checkMention(foldedSource: string, mention: string): MentionCheck {
  const occurrences = findMention(foldedSource, mention);
  if (occurrences.length === 0) return "absent";
  const everyday = EVERYDAY_WORDS.get(normalizeText(mention));
  if (!everyday) return "found";
  return occurrences.some((o) => isWrittenAsName(foldedSource, o, everyday)) ? "found" : "everyday-word";
}

export function containsMention(foldedSource: string, mention: string): boolean {
  return checkMention(foldedSource, mention) !== "absent";
}

const CONTEXT_CHARS = 60;

// When one phrase names several skills — "Motion and Trajectory Planning" — the
// model cites one word of it ("Motion") for "Motion Planning". The name still
// holds if every word of it is right there around the citation.
export function contextSupportsSkill(foldedSource: string, skill: string, mention: string): boolean {
  // An everyday word nearby proves nothing: "you excel with Microsoft Office"
  // does not name Excel. Those skills have to be cited directly.
  if (EVERYDAY_WORDS.has(normalizeText(skill))) return false;
  const wanted = [...distinctTokens(skill)].map(stem);
  if (wanted.length === 0) return false;

  return findMention(foldedSource, mention).some(({ start, end }) => {
    const around = foldedSource.slice(Math.max(0, start - CONTEXT_CHARS), end + CONTEXT_CHARS);
    const present = new Set([...distinctTokens(around)].map(stem));
    return wanted.every((t) => present.has(t));
  });
}

function stem(token: string): string {
  return token.length > 3 ? token.replace(/s$/, "") : token;
}

function distinctTokens(name: string): Set<string> {
  return new Set(
    normalizeText(name)
      .split(/[\s/,()\-:]+/)
      .map((t) => t.replace(/^\.+|\.+$/g, ""))
      .filter((t) => t && !INDISTINCT_TOKENS.has(t))
  );
}

function compact(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9+#]/g, "");
}

const ACRONYM_SMALL_WORDS = new Set(["and", "of", "for", "the", "&"]);

function words(name: string): string[] {
  return normalizeText(name)
    .split(/[\s/\-,]+/)
    .filter(Boolean);
}

// Acronyms treat small words both ways — Amazon Web Services is AWS, but Bill
// of Materials is BOM — so both readings are offered.
function acronyms(name: string): string[] {
  const all = words(name);
  const withSmall = all.map((w) => w[0]).join("");
  const withoutSmall = all.filter((w) => !ACRONYM_SMALL_WORDS.has(w)).map((w) => w[0]).join("");
  return [withSmall, withoutSmall];
}

// "data extraction, transformation and loading" spells ETL in its last three
// words; the acronym can come from any run of a phrase's words.
function phraseSpells(phrase: string, abbreviation: string): boolean {
  if (abbreviation.length < 3) return false;
  const all = words(phrase);
  for (let from = 0; from < all.length; from++) {
    for (let to = from + 1; to <= all.length; to++) {
      if (acronyms(all.slice(from, to).join(" ")).includes(abbreviation)) return true;
    }
  }
  return false;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

// Optimal string alignment distance, which counts a swapped pair of letters as
// one edit — the commonest typo.
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// A posting's misspelling ("Phython") still names the skill. Short names get no
// slack at all: one letter is the whole difference between C and R.
function isTypoOf(skill: string, mention: string): boolean {
  const a = compact(skill);
  const b = compact(mention);
  const shorter = Math.min(a.length, b.length);
  if (shorter < 5) return false;
  return editDistance(a, b) <= (shorter >= 9 ? 2 : 1);
}

function supportsWhole(skill: string, mention: string): boolean {
  if (normalizeSkill(skill) === normalizeSkill(mention)) return true;
  if (compact(skill) === compact(mention)) return true;

  const shortMention = compact(mention);
  const shortSkill = compact(skill);
  const singularMention = shortMention.length >= 3 ? shortMention.replace(/s$/, "") : shortMention;
  if (shortMention.length >= 2 && acronyms(skill).some((a) => a === shortMention || a === singularMention)) {
    return true;
  }
  if (shortSkill.length >= 2 && acronyms(mention).includes(shortSkill)) return true;
  if (phraseSpells(mention, shortSkill)) return true;

  if (isTypoOf(skill, mention)) return true;
  const stems = (name: string) => new Set([...distinctTokens(name)].map(stem));
  return isSubset(stems(skill), stems(mention));
}

// "AI/ML" names two skills, and the model rightly gives each its own entry
// citing the same words. So does "Graph DB (Neptune/Neo4j)".
function mentionParts(mention: string): string[] {
  return mention
    .split(/\s*(?:\/|,|&|\(|\)|\band\b|\bor\b)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

// Whether the posting's words name the skill as the model called it: the same
// thing under a known alias ("k8s" → Kubernetes), its acronym ("AWS" → Amazon
// Web Services), a misspelling of it, or the same name less a vendor or filler
// word ("MS Excel" → Excel). A name that brings in anything the words do not
// say fails.
export function mentionSupportsSkill(skill: string, mention: string): boolean {
  if (supportsWhole(skill, mention)) return true;
  const parts = mentionParts(mention);
  return parts.length > 1 && parts.some((part) => supportsWhole(skill, part));
}

function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

// The words a posting wraps around a skill are not part of its name:
// "Knowledge of GD&T" is GD&T, "User Acceptance Testing (UAT)" is User
// Acceptance Testing. Only applied to names, never to the words being checked.
const LEADING_FILLER =
  /^(?:(?:basic|strong|solid|good|working|general|advanced|hands-on|some)\s+)?(?:(?:knowledge|understanding|experience|familiarity|proficiency|expertise|exposure)\s+(?:of|in|with|to)|familiar\s+with|(?:the\s+)?ability\s+to|able\s+to)\s+/i;
const TRAILING_FILLER =
  /\s+(?:(?:is|are|would be|will be|considered)\s+)?(?:(?:an?\s+)?(?:asset|plus|bonus)|preferred|required|desirable|an advantage)$|\s+(?:knowledge|skills?|experience|concepts|principles)$/i;

export function displayName(name: string): string {
  const stripped = cleanName(name)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(LEADING_FILLER, "")
    .replace(TRAILING_FILLER, "")
    .replace(TRAILING_FILLER, "")
    .trim();
  return stripped || cleanName(name);
}

function isCandidate(value: unknown): value is SkillCandidate {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.skill === "string" && typeof v.mention === "string";
}

// Whether the model's name is a rewording of the posting's words rather than a
// different thing: "Graston Technique" for "Graston Tools" shares a word with
// them, as does "Regulatory Compliance" for "Complying With Regulations" once
// both are cut to the root; "Django" for "Python", or "Next.js" for "next
// generation", shares none. Loose on purpose: a rewording is stored under the
// posting's words, never the model's, so it cannot claim more than they say.
function root(token: string): string {
  return token.length >= 6 ? token.slice(0, 5) : stem(token);
}

function isRewording(skill: string, mention: string): boolean {
  const roots = new Set([...distinctTokens(mention)].map(root));
  return [...distinctTokens(skill)].some((t) => roots.has(root(t)));
}

function judge(candidate: SkillCandidate, foldedSource: string): SkillVerdict {
  const skill = displayName(candidate.skill);
  const mention = cleanName(candidate.mention);

  if (!skill || !mention) {
    return { kind: "rejected", skill, mention, reason: "empty" };
  }

  const check = checkMention(foldedSource, mention);
  if (check === "absent") {
    return { kind: "rejected", skill, mention, reason: "mention not in posting" };
  }
  if (check === "everyday-word") {
    return { kind: "rejected", skill, mention, reason: "used as an everyday word, not a name" };
  }
  if (mentionSupportsSkill(skill, mention) || contextSupportsSkill(foldedSource, skill, mention)) {
    return { kind: "kept", skill, mention };
  }
  if (isRewording(skill, mention)) {
    return { kind: "renamed", skill: displayName(mention), mention, proposed: skill };
  }
  return { kind: "rejected", skill, mention, reason: "name not supported by mention" };
}

function isAcceptableName(name: string): boolean {
  const lower = normalizeText(name);
  return lower.length <= MAX_SKILL_LENGTH && !NOT_SKILLS.has(lower);
}

export function verifySkills(raw: unknown, sourceText: string): VerifiedSkills {
  if (!Array.isArray(raw)) {
    throw new Error("expected a JSON array of {skill, mention} objects");
  }

  const foldedSource = foldText(sourceText);
  const verdicts: SkillVerdict[] = [];
  const seen = new Set<string>();
  const skills: string[] = [];

  for (const item of raw) {
    if (!isCandidate(item)) {
      verdicts.push({ kind: "rejected", skill: "", mention: "", reason: "malformed entry" });
      continue;
    }

    const verdict = judge(item, foldedSource);
    if (verdict.kind !== "rejected" && !isAcceptableName(verdict.skill)) {
      verdicts.push({ kind: "rejected", skill: verdict.skill, mention: verdict.mention, reason: "not a skill" });
      continue;
    }
    verdicts.push(verdict);
    if (verdict.kind === "rejected") continue;

    const key = normalizeSkill(verdict.skill);
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(verdict.skill);
  }

  return { skills, verdicts };
}
