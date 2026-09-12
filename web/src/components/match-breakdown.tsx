"use client";

import type { MatchScore } from "@/lib/resume/types";
import { matchTone, TONE_TEXT } from "@/lib/format";
import { WarningIcon } from "./icons";
import { SkillPick } from "./skill-pick";
import { SKILL_POINTS, TYPICAL_OVERLAP } from "@/lib/resume/match-engine";

const neutralSkills = Math.round(TYPICAL_OVERLAP * SKILL_POINTS);

const MAX = { skills: 70, level: 15, program: 15 } as const;

export function MatchBreakdown({ score }: { score: MatchScore }) {
  const { breakdown, warnings, debug } = score;
  const skills = debug.skills;
  // "pending" means the posting's skills haven't been extracted yet, so an
  // empty list says nothing about the job. String() keeps this compiling
  // whether or not the source union includes "pending".
  const pending = String(skills.source) === "pending";
  const foundBy = skills.source === "ai" ? "AI" : "keyword match";

  return (
    <div className="space-y-6">
      <div>
        <p className={`text-2xl font-semibold tracking-tight ${TONE_TEXT[matchTone(score.score)]}`}>
          {score.score}% match
        </p>
        <p className="text-[13px] text-slate mt-1">
          Scored against your resume on skills, level and program. It updates when you change your resume or details.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ScoreBar label="Skills" value={breakdown.skills} max={MAX.skills} />
        <ScoreBar label="Level" value={breakdown.level} max={MAX.level} />
        <ScoreBar label="Program" value={breakdown.program} max={MAX.program} />
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[13px] text-poor">
              <WarningIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {w.message}
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="text-[13.5px] font-semibold text-ink">Skills</h4>
          <span className="text-xs text-stone">
            {pending
              ? "Still being extracted"
              : skills.jobSkills.length > 0
                ? `${skills.matched.length} of ${skills.jobSkills.length} · found by ${foundBy}`
                : `None found by ${foundBy}`}
          </span>
        </div>
        {skills.jobSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.matched.map((m, i) => (
              <SkillPick
                key={`${m.skill}-${i}`}
                name={m.skill}
                showCheck={false}
                className="text-xs font-medium px-2 py-0.5 rounded-full bg-good/10 text-good"
                suffix={m.via ? " ≈" : m.evidenceType === "inferred" || m.evidenceType === "weak_inferred" ? " ~" : ""}
                title={
                  m.via
                    ? `Half credit: you know ${m.via}, a related skill — click to add ${m.skill} itself`
                    : `${m.evidenceType.replace("_", " ")} · confidence ${Math.round(m.confidence * 100)}% — click to say how well you know it`
                }
              />
            ))}
            {skills.missing.map((s, i) => (
              <SkillPick
                key={`${s}-${i}`}
                name={s}
                className="text-xs font-medium px-2 py-0.5 rounded-full border border-dashed border-poor/40 text-poor"
              />
            ))}
          </div>
        ) : pending ? (
          <p className="text-[13px] text-slate">
            This posting&apos;s skills are still being extracted. Until they&apos;re in, skills score a neutral {neutralSkills} of {MAX.skills}.
          </p>
        ) : (
          <p className="text-[13px] text-slate">
            This posting names no skills, so skills score a neutral {neutralSkills} of {MAX.skills}.
          </p>
        )}
        {skills.jobSkills.length > 0 && (
          <p className="text-xs text-stone">
            Green skills are yours (≈ means half credit through a related skill you have); dashed ones are missing. Click any skill to add it or say how well you know it — skills you know only a little count for half. A short skill list says less, so its score leans toward a typical match until the posting names more.
          </p>
        )}
      </section>

      <section className="space-y-1.5">
        <h4 className="text-[13.5px] font-semibold text-ink">Level</h4>
        <p className="text-[13px] text-charcoal">{levelText(score)}</p>
      </section>

      <section className="space-y-1.5">
        <h4 className="text-[13.5px] font-semibold text-ink">Program</h4>
        <p className="text-[13px] text-charcoal">{programText(score)}</p>
      </section>
    </div>
  );
}

function levelText({ debug }: MatchScore): string {
  const { historyMatch, jobLevel, userCoopTerm } = debug.level;
  if (historyMatch) return `You're going into work term ${userCoopTerm}. ${historyMatch}`;
  if (jobLevel) return `Posting is for ${jobLevel}; you're going into work term ${userCoopTerm}.`;
  return `No level or hiring history on this posting, so level scores a neutral 8 of ${MAX.level}.`;
}

function programText({ debug }: MatchScore): string {
  const { userProgram, jobMentionsProgram, matched } = debug.program;
  if (!userProgram) return `Set your program in Resume → Your details. Until then it scores a neutral 8 of ${MAX.program}.`;
  if (!jobMentionsProgram) return `No program requirement, so ${userProgram} gets the full ${MAX.program}.`;
  if (matched) return `${userProgram} matches the programs this posting asks for.`;
  return `${userProgram} isn't among the programs this posting asks for (3 of ${MAX.program}).`;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const fill = pct >= 75 ? "bg-good" : pct >= 50 ? "bg-fair" : "bg-poor/70";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5 text-xs">
        <span className="text-slate">{label}</span>
        <span className="font-semibold text-ink tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-hairline-soft rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
