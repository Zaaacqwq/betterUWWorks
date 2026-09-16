import type { SkillLevel } from "@/lib/resume/types";
import { normalizeSkill } from "@/lib/resume/skill-utils";
import type { ResumeLine, ResumeSection } from "./types";

// The resume as the checks see it: numbered lines R1, R2, ... that a check can
// cite, followed by a line for each skill the student added or rated on the
// site. Contact details are left out; nothing is judged on them and they
// needn't leave the server.

const MAX_RESUME_LINES = 200;
// Section titles are looked for inside lines longer than this: a resume whose
// line breaks were lost (older uploads have none) runs them into the text.
const TITLE_SEARCH = 80;
const CHUNK_CHARS = 240;

// Contact details wherever they sit on a line: an email, a phone number, or a
// labelled link ("LinkedIn: linkedin.com/in/..."). A project's own link, with
// no label, stays: it says what the project is.
const CONTACT = [
  /\S+@\S+\.\S+/g,
  /\+?1?[\s.‐-‒-]?\(?\d{3}\)?[\s.‐-‒-]?\d{3}[\s.‐-‒-]?\d{4}\b/g,
  /\b(e-?mail|phone|tel|mobile|cell|linkedin|github|portfolio|website|web)\s*:\s*\S+/gi,
];

function withoutContact(line: string): string {
  return CONTACT.reduce((l, pattern) => l.replace(pattern, " "), line);
}

// Where a run-together resume breaks: before a bullet, after a sentence, and
// before a section title in capitals ("EXPERIENCE", "PROJECTS").
const BULLET = /\s*([•●▪◦■➢➤])\s*/g;
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z])/;

function isSectionTitle(word: string, previous: string | undefined): boolean {
  if (!/^[A-Z][A-Za-z]{4,}$/.test(word)) return false;
  const capitals = word.replace(/[^A-Z]/g, "").length;
  // "MySQL" in a list of skills is a name, not a title.
  return capitals / word.length >= 0.8 && !/[,:/&]$/.test(previous ?? "");
}

function splitAtTitles(line: string): string[] {
  const words = line.split(" ");
  const out: string[] = [];
  let current: string[] = [];
  words.forEach((word, i) => {
    if (current.length > 0 && isSectionTitle(word, words[i - 1])) {
      out.push(current.join(" "));
      current = [];
    }
    current.push(word);
  });
  if (current.length > 0) out.push(current.join(" "));
  return out;
}

/** Cuts a line into pieces of at most CHUNK_CHARS, between words. */
function chunk(line: string): string[] {
  if (line.length <= CHUNK_CHARS) return [line];
  const out: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    if (current && current.length + 1 + word.length > CHUNK_CHARS) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}

function breakLine(line: string): string[] {
  return line
    .split(SENTENCE_END)
    .flatMap((part) => (part.length > TITLE_SEARCH ? splitAtTitles(part) : [part]))
    .flatMap((part) => chunk(part.trim()));
}

// A line the PDF wrapped carries on in lower case: it belongs to the one before.
// A link ("github.com/...") starts in lower case too, and stands alone.
function joinWrapped(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (out.length > 0 && /^[a-z(][^\s./]*(\s|$)/.test(line)) out[out.length - 1] += ` ${line}`;
    else out.push(line);
  }
  return out;
}

export function resumeTextLines(text: string): string[] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(BULLET, "\n$1 ")
    .split("\n")
    .map((l) => withoutContact(l).replace(/\s+/g, " ").replace(/^[|·,\s]+|[|·,\s]+$/g, ""))
    .filter(Boolean);
  return joinWrapped(lines)
    .flatMap(breakLine)
    .filter((l) => /[a-z].*[a-z]/i.test(l))
    .slice(0, MAX_RESUME_LINES);
}

// A resume's own headings, however they are capitalised or worded. Read in
// order down the page: every line belongs to the heading above it.
const SECTION_HEADINGS: [ResumeSection, RegExp][] = [
  ["work", /^(work|professional|industry|employment|relevant)?\s*experience\b|^employment\b|^internships?\b|^work history\b|^co-?op experience\b/i],
  ["project", /^(personal |academic |technical |selected )?projects?\b|^portfolio\b/i],
  ["education", /^education\b|^academics?\b|^coursework\b|^courses\b/i],
  ["skills", /^(technical |core |key )?skills\b|^technologies\b|^technical summary\b|^tools\b|^languages\b(?!.{0,20}spoken)/i],
  ["other", /^(summary|objective|profile|about|awards?|honou?rs?|certifications?|activities|leadership|volunteer|interests|publications|additional|references)\b/i],
];

/** The section a line starts, if it is one of the resume's headings. */
export function sectionOf(line: string): ResumeSection | null {
  // A heading is short, or a title run together with what follows it — the
  // start of the line is what says which section it opens.
  const head = line.slice(0, 40);
  for (const [section, pattern] of SECTION_HEADINGS) {
    if (pattern.test(head.trim())) return section;
  }
  return null;
}

/** Files each line under the heading above it; anything before the first is "other". */
export function classifyLines(lines: ResumeLine[]): ResumeLine[] {
  let current: ResumeSection = "other";
  return lines.map((line) => {
    if (line.source === "skill") return { ...line, section: "added" as const };
    const heading = sectionOf(line.text);
    if (heading) current = heading;
    return { ...line, section: current };
  });
}

export function buildResumeLines(text: string): ResumeLine[] {
  return classifyLines(
    resumeTextLines(text).map((t, i) => ({ n: i + 1, text: t, source: "resume" as const, active: true }))
  );
}

const LEVEL_WORDS: Record<Exclude<SkillLevel, "none">, string> = {
  proficient: "knows it well",
  familiar: "has used it a little",
};

export const DISOWNED_PREFIX = "The student says they do NOT have";

/**
 * What the student has told the site about their skills, one line each: skills
 * they added, and levels they set on skills from the resume. A skill they say
 * they don't have becomes a line saying so, which the checks must not cite.
 */
export function skillLines(extraSkills: string[], levels: Record<string, SkillLevel>): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const name of extraSkills) {
    const key = normalizeSkill(name);
    if (!name.trim() || seen.has(key)) continue;
    seen.add(key);
    const level = levels[key] ?? "proficient";
    lines.push(
      level === "none" ? `${DISOWNED_PREFIX}: ${name.trim()}` : `Added by the student: ${name.trim()} (${LEVEL_WORDS[level]})`
    );
  }
  for (const [key, level] of Object.entries(levels)) {
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(level === "none" ? `${DISOWNED_PREFIX}: ${key}` : `The student rates their ${key}: ${LEVEL_WORDS[level]}`);
  }
  return lines;
}

export interface SkillLineChange {
  lines: ResumeLine[];
  added: ResumeLine[];
  removed: ResumeLine[];
}

/**
 * Brings the resume's skill lines in line with what the student has now said.
 * Lines are only ever appended or switched off, so a number a stored check
 * cites still means the same words.
 */
export function updateSkillLines(current: ResumeLine[], wanted: string[]): SkillLineChange {
  const want = new Set(wanted);
  const activeSkill = new Set(current.filter((l) => l.source === "skill" && l.active).map((l) => l.text));
  const removed: ResumeLine[] = [];
  const lines = current.map((l) => {
    if (l.source === "skill" && l.active && !want.has(l.text)) {
      const off = { ...l, active: false };
      removed.push(off);
      return off;
    }
    return l;
  });
  const added: ResumeLine[] = [];
  let next = lines.reduce((max, l) => Math.max(max, l.n), 0) + 1;
  for (const text of wanted) {
    if (activeSkill.has(text)) continue;
    const line: ResumeLine = { n: next++, text, source: "skill", active: true, section: "added" };
    lines.push(line);
    added.push(line);
    activeSkill.add(text);
  }
  return { lines, added, removed };
}

/** Where each numbered line sits, for weighing what a match rests on. Lines
 * stored before sections were read are filed on the spot. */
export function resumeSections(lines: ResumeLine[]): Map<number, ResumeSection> {
  const filed = lines.some((l) => l.section) ? lines : classifyLines(lines);
  return new Map(filed.map((l) => [l.n, l.section ?? "other"]));
}

/** The resume as it goes into a check: active lines, numbered as stored. */
export function renderResume(lines: ResumeLine[]): string {
  return lines
    .filter((l) => l.active)
    .map((l) => `R${l.n}: ${l.text}`)
    .join("\n");
}

/** The skill a skill line is about: "Added by the student: Docker (...)" -> "docker". */
export function skillOfLine(text: string): string | null {
  const m =
    text.match(/^Added by the student: (.+?) \(/) ??
    text.match(/^The student rates their (.+?):/) ??
    text.match(new RegExp(`^${DISOWNED_PREFIX}: (.+)$`));
  return m ? m[1].trim() : null;
}
