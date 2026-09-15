import { LINE_IMPORTANCES, LINE_KINDS, type LineImportance, type LineKind, type PostingLine, type TaggedLine } from "./types";

// Tagging a posting's lines: what kind of line each is and whether the posting
// requires it. Done once per posting and shared by every student, so a
// tagging that wobbles between runs still treats everyone the same.

export const LINE_TAGS_SYSTEM = `You tag the numbered lines of a co-op job posting. Lines marked [REQ] come from its requirements, [DUTY] from its responsibilities, [TEXT] from a general description.

For every line output [line, kind, importance].

kind is one of:
- "skill": a named tool, language, method or area of knowledge ("Experience with Python", "Knowledge of GAAP").
- "experience": having done a kind of work ("Experience building data pipelines", "Previous customer service experience").
- "duty": a task of this job, usually a [DUTY] line ("Build APIs in Go", "Prepare monthly reports").
- "trait": a personal quality or soft skill ("Detail oriented", "Strong communication skills", "Self-starter").
- "eligibility": degree, program, year, co-op term, GPA, citizenship, licence, security clearance, availability or location to work from.
- "outcome": only what the student will gain, learn or be exposed to ("Gain exposure to...", "You will learn...").
- "heading": a label that introduces other lines ("Nice to have", "Bonus Points For", "Technical").
- "other": anything else: company description, perks, how to apply, an equal-opportunity statement.

importance is "preferred" for lines listed under a heading like Bonus, Nice to have, Assets or Preferred, and for lines saying "an asset", "preferred", "a plus", "exposure to" or "interest in". Everything else is "required".

Answer with JSON only, one entry per line in order: {"lines": [[1, "skill", "required"], [2, "heading", "required"], ...]}`;

const SECTION_MARK = { req: "REQ", duty: "DUTY", summary: "TEXT" } as const;

export function lineTagsPrompt(title: string, lines: PostingLine[]): string {
  const numbered = lines.map((l) => `${l.lineNo}. [${SECTION_MARK[l.section]}] ${l.text}`).join("\n");
  return `Posting: ${title}\n\n${numbered}`;
}

export class TagsError extends Error {}

// A tagging that leaves out more than this share of the lines is asked for
// again; below it, the missing lines are treated as plain requirements.
const MAX_MISSING_SHARE = 0.1;

function isKind(value: unknown): value is LineKind {
  return typeof value === "string" && (LINE_KINDS as readonly string[]).includes(value);
}

function isImportance(value: unknown): value is LineImportance {
  return typeof value === "string" && (LINE_IMPORTANCES as readonly string[]).includes(value);
}

/** Checks the model's tags against the lines it was given and fills any gaps. */
export function verifyTags(raw: unknown, lines: PostingLine[]): TaggedLine[] {
  const entries = (raw as { lines?: unknown })?.lines;
  if (!Array.isArray(entries)) throw new TagsError("no lines array in the answer");

  const tags = new Map<number, { kind: LineKind; importance: LineImportance }>();
  for (const entry of entries) {
    if (!Array.isArray(entry)) continue;
    const [lineNo, kind, importance] = entry;
    if (typeof lineNo !== "number" || !isKind(kind)) continue;
    tags.set(lineNo, { kind, importance: isImportance(importance) ? importance : "required" });
  }

  const missing = lines.filter((l) => !tags.has(l.lineNo)).length;
  if (lines.length > 0 && missing / lines.length > MAX_MISSING_SHARE) {
    throw new TagsError(`${missing} of ${lines.length} lines left untagged`);
  }

  const tagged = lines.map((l) => ({ ...l, ...(tags.get(l.lineNo) ?? { kind: fallbackKind(l), importance: "required" as const }) }));
  return applyWording(tagged);
}

function fallbackKind(line: PostingLine): LineKind {
  return line.section === "duty" ? "duty" : line.section === "summary" ? "other" : "skill";
}

// Phrases that settle importance whatever the model said. Measured on the same
// posting twice, the model marked "interest in ..." lines preferred one time
// and required the next; the posting's own words shouldn't depend on the run.
const PREFERRED_WORDING =
  /\b(an? asset|are assets|is a plus|a bonus|bonus points|nice[- ]to[- ]have|preferred|desired|desirable|exposure to|interest in|would be beneficial|considered an asset)\b/i;
// "Preferred Qualifications" is preferred; "Requirements" or "Technical" start
// a required list again.
const PREFERRED_HEADING = /\b(bonus|nice[- ]to[- ]have|assets?|preferred|desired|desirable|optional|a plus)\b/i;

/**
 * Lines under a "Nice to have" heading are preferred until the next heading,
 * and a line's own wording ("an asset", "interest in") makes it preferred.
 */
export function applyWording(lines: TaggedLine[]): TaggedLine[] {
  let underPreferred = false;
  let section = lines[0]?.section;
  return lines.map((line) => {
    if (line.section !== section) {
      section = line.section;
      underPreferred = false;
    }
    if (line.kind === "heading") {
      underPreferred = PREFERRED_HEADING.test(line.text);
      return line;
    }
    const preferred = underPreferred || PREFERRED_WORDING.test(line.text);
    return preferred ? { ...line, importance: "preferred" } : line;
  });
}
