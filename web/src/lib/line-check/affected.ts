import type { StoredResume } from "@/db/schema";
import { EmbedError, cosine, embedResumeLines } from "./embed";
import { lineIndex, linesOf } from "./embed-run";
import { kick } from "./grader";
import { skillOfLine } from "./resume-lines";
import { currentChecks, markStale } from "./store";
import type { LineGrade, ResumeLine } from "./types";

// When a student adds a skill, rates one, or says they don't have it, only the
// posting lines that skill could bear on are checked again, not every posting.
// Lines are found three ways: the skill's name in the line, lines whose vector
// is close to the skill's, and lines whose check cited a skill line now gone.

// Posting lines closest to the skill that are rechecked, beyond those naming
// it. Similarity is ranked rather than cut at a fixed value: measured on the
// production lines, a skill's own lines and unrelated ones overlap in raw
// score, but rank well — embedding the bare skill name put 97% of the lines
// naming it among its closest (the "Added by the student: ..." sentence
// managed 74%). A line rechecked for nothing costs a few tokens; one missed
// keeps a wrong grade.
const CLOSEST = 150;

export interface SkillChange {
  added: ResumeLine[];
  removed: ResumeLine[];
}

/** A pattern matching the skill as a whole word, symbols included ("C++", "C#", ".NET"). */
export function skillPattern(skill: string): RegExp {
  const escaped = skill.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "+" and "#" carry on a name: "C" must not find "C++" or "C#".
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9+#])`, "i");
}

type Candidates = Map<string, Set<number>>;

function add(candidates: Candidates, jobId: string, lineNo: number) {
  const set = candidates.get(jobId) ?? new Set<number>();
  set.add(lineNo);
  candidates.set(jobId, set);
}

/**
 * Which checked lines to redo. Gaining a skill can only raise a grade, so lines
 * already met are left; losing one can only lower it, so lines already unmet
 * are left. A level change is both, and redoes either.
 */
export function selectStale(
  candidates: Candidates,
  checks: Map<string, LineGrade[]>,
  change: { gained: boolean; lost: boolean }
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const [jobId, lineNos] of candidates) {
    const grades = checks.get(jobId);
    if (!grades) continue;
    const redo = grades
      .filter(([lineNo, grade]) => {
        if (!lineNos.has(lineNo) || grade === -1) return false;
        if (change.gained && change.lost) return true;
        return change.gained ? grade < 2 : grade > 0;
      })
      .map(([lineNo]) => lineNo);
    if (redo.length > 0) out.set(jobId, redo);
  }
  return out;
}

export async function recheckAffected(resume: StoredResume, change: SkillChange): Promise<number> {
  const checks = new Map((await currentChecks(resume.id, resume.version)).map((c) => [c.jobId, c.grades]));
  if (checks.size === 0) return 0;
  const changed = [...change.added, ...change.removed];
  const candidates: Candidates = new Map();

  // The skill's name in a posting line.
  const patterns = changed.map((l) => skillOfLine(l.text)).filter((s): s is string => !!s).map(skillPattern);
  if (patterns.length > 0) {
    for (const line of await linesOf([...checks.keys()])) {
      if (patterns.some((p) => p.test(line.text))) add(candidates, line.jobId, line.lineNo);
    }
  }

  // Lines close to the skill in meaning ("containers" for Docker).
  try {
    const names = changed.map((l) => skillOfLine(l.text) ?? l.text);
    const [vectors, index] = await Promise.all([embedResumeLines(names), lineIndex()]);
    for (const v of vectors) {
      index.vectors
        .map((w, i) => ({ i, sim: cosine(v, w) }))
        .filter((s) => checks.has(index.refs[s.i].jobId))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, CLOSEST)
        .forEach((s) => add(candidates, index.refs[s.i].jobId, index.refs[s.i].lineNo));
    }
  } catch (err) {
    if (!(err instanceof EmbedError)) throw err;
    console.error(`[line-check] similar-line search skipped: ${err.message}`);
  }

  // Lines whose check rested on a skill line that is gone.
  const gone = new Set(change.removed.map((l) => l.n));
  for (const [jobId, grades] of checks) {
    for (const [lineNo, , evidence] of grades) if (gone.has(evidence)) add(candidates, jobId, lineNo);
  }

  const stale = selectStale(candidates, checks, {
    gained: change.added.length > 0,
    lost: change.removed.length > 0,
  });
  const marked = await markStale(resume.id, resume.version, stale);
  kick(resume.email);
  return marked;
}
