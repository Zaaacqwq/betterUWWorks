import { buildSkillSource } from "@/lib/job-skills/source";
import type { LineSection, PostingLine } from "./types";

// Splits a posting into the lines its requirements and duties are written as.
// WaterlooWorks keeps a posting's line breaks, and most postings put one
// requirement on each line, so a line is the natural unit; a line that is
// really a paragraph is split into its sentences.

export interface PostingText {
  title: string;
  rawDetail: unknown;
}

// A long posting's tail is boilerplate more often than requirements, and every
// line costs every student a check.
export const MAX_LINES = 60;
// Longer than this is a paragraph, not one requirement.
const PARAGRAPH_CHARS = 220;
const MIN_CHARS = 3;

// Bullets and list numbering at the start of a line: "- ", "• ", "> ", "1. ",
// "(a) ", "iv) ".
const LEAD = /^(?:[\s\-–—•·*>▪●◦○■□✓✔➢➤→]+|\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s+)+/i;
// A sentence ends at . ! ? or ; followed by a space and a capital (or an
// opening bracket). Abbreviations like "e.g. Python" are left alone because
// the next word is not capitalised often enough to matter.
const SENTENCE_END = /(?<=[.!?;])\s+(?=[A-Z(“"])/;

export function cleanLine(line: string): string {
  return line.replace(LEAD, "").replace(/\s+/g, " ").trim();
}

function hasWords(line: string): boolean {
  return /[a-z]{2}/i.test(line);
}

export function splitText(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((raw) => {
      const line = cleanLine(raw);
      return line.length > PARAGRAPH_CHARS ? line.split(SENTENCE_END).map(cleanLine) : [line];
    })
    .filter((line) => line.length >= MIN_CHARS && hasWords(line));
}

// Sections a posting names for itself ("Qualifications", "What you will do",
// "Nice to have") alongside WaterlooWorks' own. Anything else — About us,
// Benefits, a disclosure — says nothing about the student.
const REQUIREMENT_LABEL =
  /qualif|requir|skill|bring|experience|education|nice[- ]to[- ]have|assets?\b|preferred|ideal candidate|about you|who you are|you have|looking for|competenc|knowledge|must[- ]have/i;
const DUTY_LABEL =
  /responsib|what you(?:'|’)?ll do|what you will do|you will|duties|day[- ]to[- ]day|the role|role description|tasks|you(?:'|’)?ll be doing|job description/i;
const STANDARD: Record<string, LineSection> = {
  "required skills": "req",
  "job responsibilities": "duty",
};

interface Source {
  section: LineSection;
  // The section's own name, kept as a line of its own so "Nice to have" can
  // mark what follows it; WaterlooWorks' standard sections need none.
  heading: string | null;
  text: string;
}

function sourcesOf(posting: PostingText): Source[] {
  const sections = buildSkillSource(posting).slice(1); // [0] is the title
  const chosen: Source[] = [];
  const general: Source[] = [];
  for (const { label, text } of sections) {
    const key = label.toLowerCase().trim();
    if (STANDARD[key]) chosen.push({ section: STANDARD[key], heading: null, text });
    // "What you will bring" is a requirement, though "you will" reads as a duty.
    else if (REQUIREMENT_LABEL.test(label)) chosen.push({ section: "req", heading: label, text });
    else if (DUTY_LABEL.test(label)) chosen.push({ section: "duty", heading: label, text });
    else if (key === "job summary") general.unshift({ section: "summary", heading: null, text });
    else general.push({ section: "summary", heading: label, text });
  }
  // A posting with neither requirements nor duties is read from its summary
  // and whatever else it says.
  const found = chosen.filter((s) => splitText(s.text).length > 0);
  if (found.length === 0) return general;
  // Requirements before duties, and in each WaterlooWorks' own section first:
  // it has no heading of its own, so it must not follow a "Nice to have" one
  // (the stored sections come back in no particular order).
  const rank = (s: Source) => (s.section === "req" ? 0 : 2) + (s.heading ? 1 : 0);
  return [...found].sort((a, b) => rank(a) - rank(b));
}

export function splitPosting(posting: PostingText): PostingLine[] {
  const seen = new Set<string>();
  const lines: PostingLine[] = [];
  for (const { section, heading, text } of sourcesOf(posting)) {
    const body = splitText(text);
    for (const line of heading ? [heading.replace(/:\s*$/, ""), ...body] : body) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({ lineNo: lines.length + 1, section, text: line });
      if (lines.length >= MAX_LINES) return lines;
    }
  }
  return lines;
}
