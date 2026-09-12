import { normalizeSkill } from "@/lib/resume/skill-utils";
import type { AdviceFacts } from "./facts";
import type { AdviceGap, AdviceHighlight } from "./types";

// What the model says is kept only where it points at the facts it was given:
// an experience the student listed, skills the posting asks for that the
// student has, gaps that really are gaps. Anything else is dropped, so the
// advice can't tell a student to lead with a skill they don't have.

const MAX_SENTENCE_WORDS = 45;
const MAX_ITEMS = 3;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function sentence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text && text.split(" ").length <= MAX_SENTENCE_WORDS ? text : null;
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function verifyAdvice(raw: unknown, facts: AdviceFacts): { highlights: AdviceHighlight[]; gaps: AdviceGap[] } {
  const reply = asRecord(raw) ?? {};
  // A skill the student knows only a little is not one to lead with.
  const matched = new Map(facts.matched.filter((m) => !m.familiar).map((m) => [normalizeSkill(m.skill), m.skill]));
  const missing = new Map(facts.missing.map((s) => [normalizeSkill(s), s]));

  const highlights: AdviceHighlight[] = [];
  for (const item of listOf(reply.highlights)) {
    const record = asRecord(item);
    const experience = facts.experiences.find((e) => e.id === Number(record?.experience));
    const why = sentence(record?.why);
    const skills = [
      ...new Set(
        listOf(record?.skills)
          .filter((s): s is string => typeof s === "string")
          .map((s) => matched.get(normalizeSkill(s)))
          .filter((s): s is string => s !== undefined)
      ),
    ];
    if (!experience || !why || skills.length === 0) continue;
    if (highlights.some((h) => h.experience === experience.label)) continue;
    highlights.push({ experience: experience.label, skills, why });
  }

  const gaps: AdviceGap[] = [];
  for (const item of listOf(reply.gaps)) {
    const record = asRecord(item);
    const skill = typeof record?.skill === "string" ? missing.get(normalizeSkill(record.skill)) : undefined;
    const suggestion = sentence(record?.suggestion);
    if (!skill || !suggestion || gaps.some((g) => g.skill === skill)) continue;
    gaps.push({ skill, suggestion });
  }

  return { highlights: highlights.slice(0, MAX_ITEMS), gaps: gaps.slice(0, MAX_ITEMS) };
}
