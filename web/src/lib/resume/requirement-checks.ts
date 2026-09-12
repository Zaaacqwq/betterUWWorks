import type { ListedDetails, ListedRequirement, RequirementKind } from "@/lib/job-details/types";
import type { MatchDebug, QualificationWarning, UserInfo } from "./types";

// Checks a student against the requirements read out of a posting
// (lib/job-details). Nothing here reads the posting's text itself: a posting
// whose details haven't been read yet gets no warnings rather than guesses.

function find(details: ListedDetails, kind: RequirementKind): ListedRequirement | undefined {
  return details.requirements.find((r) => r.kind === kind);
}

// A GPA on a 4-point scale and an average in percent can't be compared.
const FOUR_POINT_MAX = 4.33;
function sameScale(a: number, b: number): boolean {
  return a <= FOUR_POINT_MAX === b <= FOUR_POINT_MAX;
}

export function requirementWarnings(
  userInfo: UserInfo | null,
  details: ListedDetails | null | undefined
): QualificationWarning[] {
  if (!userInfo || !details) return [];
  const warnings: QualificationWarning[] = [];

  const gpa = find(details, "gpa");
  if (gpa?.required && gpa.value != null && userInfo.gpa != null && sameScale(gpa.value, userInfo.gpa) && userInfo.gpa < gpa.value) {
    warnings.push({ type: "gpa", message: `Requires a GPA of ${gpa.value}; yours is ${userInfo.gpa}` });
  }

  const term = find(details, "min_work_term");
  if (term?.required && term.value != null && userInfo.coopTermNumber < term.value) {
    warnings.push({
      type: "coop_term",
      message: `Requires work term ${term.value} or later; you're on term ${userInfo.coopTermNumber}`,
    });
  }

  const year = find(details, "min_year");
  if (year?.required && year.value != null && userInfo.yearLevel != null && userInfo.yearLevel < year.value) {
    warnings.push({ type: "year_level", message: `Requires year ${year.value} or later; you're in year ${userInfo.yearLevel}` });
  }

  const citizenship = find(details, "citizenship");
  if (citizenship?.required && userInfo.citizenOrPermanentResident === false) {
    warnings.push({ type: "citizenship", message: citizenship.summary });
  }

  const licence = find(details, "drivers_licence");
  if (licence?.required && userInfo.hasDriversLicence === false) {
    warnings.push({ type: "drivers_licence", message: licence.summary });
  }

  return warnings;
}

const PROGRAM_ALIASES: Record<string, string[]> = {
  "computer science": ["cs", "comp sci", "computing"],
  "computer engineering": ["ce", "comp eng"],
  "software engineering": ["se", "swe"],
  "electrical engineering": ["ee", "ece"],
  "mechanical engineering": ["me", "mech eng"],
  "systems design engineering": ["syde"],
  "management engineering": ["msci"],
  mathematics: ["math", "applied math"],
  statistics: ["stats", "stat"],
  "data science": ["data sci"],
  "business administration": ["bba", "business"],
  "accounting and financial management": ["afm"],
  "information technology management": ["itm"],
};

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole words only: "se" is Software Engineering, not the "se" in "research".
function names(text: string, name: string): boolean {
  return new RegExp(`\\b${escape(name)}\\b`, "i").test(text);
}

const FACULTY_WORDS = new Set(["engineering", "science", "sciences", "studies", "mathematics", "arts", "management"]);

// "Mechanical or Mechatronics Engineering" names Mechanical Engineering without
// ever writing it out: the program's own word and its faculty's are both there.
function namesAcrossAList(quote: string, program: string): boolean {
  const words = program.toLowerCase().split(/\s+/).filter(Boolean);
  const own = words.filter((w) => !FACULTY_WORDS.has(w));
  const faculty = words.filter((w) => FACULTY_WORDS.has(w));
  if (own.length === 0 || faculty.length === 0) return false;
  return [...own, ...faculty].every((w) => names(quote, w));
}

function programNames(program: string): string[] {
  const lower = program.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(PROGRAM_ALIASES)) {
    if (lower.includes(canonical) || aliases.some((a) => names(lower, a))) return [lower, canonical, ...aliases];
  }
  return [lower];
}

// "Engineering" on its own opens a posting to every engineering program;
// "Mechanical or Electrical Engineering" does not. Rather than list every
// discipline there is, only a general word right before it counts as "on its
// own": "an Engineering program", "Computer Science or Engineering", "Faculty
// of Engineering". Anything else before it — "Industrial and Systems
// Engineering" — names one program. "Engineering Physics" and "Engineering
// Science" are programs of their own.
const ANY_ENGINEERING =
  /(?:^|\b(?:a|an|any|in|of|the|all|or|and|related)\s+|[,/(:]\s*)engineering\b(?!\s+(?:physics|science|technology))/i;

function opensToAllEngineering(quote: string, userProgram: string): boolean {
  return /\bengineering\b/i.test(userProgram) && ANY_ENGINEERING.test(quote.trim());
}

export const PROGRAM_POINTS = { max: 15, unknown: 8, preferredElsewhere: 9, restrictedElsewhere: 3 } as const;

export function programFit(
  userInfo: UserInfo | null,
  details: ListedDetails | null | undefined
): { score: number; debug: MatchDebug["program"] } {
  const userProgram = userInfo?.program?.trim() ?? "";
  if (!userProgram || !details) {
    return { score: PROGRAM_POINTS.unknown, debug: { userProgram, jobMentionsProgram: false, matched: false } };
  }

  const requirement = find(details, "program");
  if (!requirement) {
    return { score: PROGRAM_POINTS.max, debug: { userProgram, jobMentionsProgram: false, matched: false } };
  }

  // The list keeps a program requirement's sentence; without it there is no
  // telling whether the student's program is named.
  const quote = requirement.quote;
  if (quote === undefined) {
    return { score: PROGRAM_POINTS.unknown, debug: { userProgram, jobMentionsProgram: true, matched: false } };
  }

  const matched =
    programNames(userProgram).some((name) => names(quote, name)) ||
    namesAcrossAList(quote, userProgram) ||
    opensToAllEngineering(quote, userProgram);
  const score = matched
    ? PROGRAM_POINTS.max
    : requirement.required
      ? PROGRAM_POINTS.restrictedElsewhere
      : PROGRAM_POINTS.preferredElsewhere;
  return { score, debug: { userProgram, jobMentionsProgram: true, matched } };
}
