"use client";

import { useMemo } from "react";
import { useResume } from "@/hooks/use-resume";
import { usePopover } from "@/hooks/use-popover";
import { buildCapabilityMap, isSuggestion } from "@/lib/resume/capability-utils";
import { expandSkill, normalizeSkill } from "@/lib/resume/skill-utils";
import type { SkillLevel } from "@/lib/resume/types";

// A skill chip the student can click to say they know it — to add a skill
// their resume leaves out, to say how well they know one it has, or to take
// one off: an added skill is removed, one the resume shows is marked as not
// theirs. Used wherever a posting's skills are listed, and in the resume panel.

export interface MySkill {
  // "resume": the resume shows it; "suggested": the resume only suggests it,
  // and it counts once confirmed; "added": the student added it.
  source: "resume" | "suggested" | "added" | null;
  // The level the student set; null when they haven't set one.
  level: SkillLevel | null;
  // The resume shows it, but the student said it isn't theirs.
  disowned?: boolean;
}

export function useMySkills(): (name: string) => MySkill {
  const { profile, extraSkills, skillLevels } = useResume();
  return useMemo(() => {
    const onResume = buildCapabilityMap(profile?.capabilities ?? []);
    const added = new Set(extraSkills.map(normalizeSkill));
    return (name: string) => {
      const keys = expandSkill(name).map(normalizeSkill);
      const level = keys.map((k) => skillLevels[k]).find(Boolean) ?? null;
      const onPage = keys.map((k) => onResume.get(k)).find(Boolean);
      if (onPage && level === "none") return { source: null, level: null, disowned: true };
      if (onPage) return { source: isSuggestion(onPage) && !level ? "suggested" : "resume", level };
      if (keys.some((k) => added.has(k))) return { source: "added", level: level ?? "proficient" };
      return { source: null, level: null };
    };
  }, [profile, extraSkills, skillLevels]);
}

const LEVELS: { level: SkillLevel; label: string }[] = [
  { level: "proficient", label: "I know it well" },
  { level: "familiar", label: "I've used it a little" },
];

interface SkillPickProps {
  name: string;
  // The chip's look when the student doesn't have the skill; having it is
  // marked on top of this.
  className: string;
  // Shown after the name, e.g. "~" for an inferred skill.
  suffix?: string;
  title?: string;
  // Mark a skill the student has with a tick; off where the chip's own look
  // already says so.
  showCheck?: boolean;
}

export function SkillPick({ name, className, suffix, title, showCheck = true }: SkillPickProps) {
  const { hasProfile, addSkill, setSkillLevel, removeSkill } = useResume();
  const mine = useMySkills()(name);
  const { open, setOpen, ref } = usePopover();

  if (!hasProfile) {
    return (
      <span className={className} title={title}>
        {name}
        {suffix}
      </span>
    );
  }

  const choose = (level: SkillLevel) => {
    if (mine.source === "resume" || mine.source === "suggested" || mine.disowned) setSkillLevel(name, level);
    else addSkill(name, level);
    setOpen(false);
  };
  const act = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  const marker =
    mine.source === "suggested" ? " ?" : mine.level === "familiar" ? " · a little" : mine.source && showCheck ? " ✓" : "";

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title={
          title ??
          (mine.source === "suggested"
            ? "Suggested by your resume — click to confirm"
            : mine.source
              ? "Change how well you know this"
              : "Add to your skills")
        }
        className={`${className} cursor-pointer hover:brightness-95`}
      >
        {name}
        {suffix}
        {marker && <span className="opacity-70">{marker}</span>}
      </button>
      {open && (
        <span
          role="menu"
          className="absolute z-30 top-full left-0 mt-1 w-48 bg-canvas border border-hairline rounded-lg shadow-[var(--shadow-pop)] py-1 text-left"
        >
          <span className="block px-3 pt-1 pb-1.5 text-[11px] text-stone">
            {mine.source === "suggested"
              ? `Your resume suggests ${name}. It counts once you say how well you know it.`
              : mine.source
                ? `${name} is in your skills`
                : mine.disowned
                  ? `You said ${name} isn't one of your skills`
                  : `Add ${name} to your skills`}
          </span>
          {LEVELS.map(({ level, label }) => (
            <button
              key={level}
              role="menuitemradio"
              aria-checked={mine.level === level}
              onClick={() => choose(level)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[12.5px] text-charcoal hover:bg-surface"
            >
              {label}
              {mine.level === level && <span className="text-primary">✓</span>}
            </button>
          ))}
          {mine.source === "added" && (
            <RemoveItem label="Remove from my skills" onClick={act(() => removeSkill(name))} />
          )}
          {(mine.source === "resume" || mine.source === "suggested") && (
            <RemoveItem label="I don't have this skill" onClick={act(() => setSkillLevel(name, "none"))} />
          )}
          {((mine.source === "resume" && mine.level) || mine.disowned) && (
            <button
              role="menuitem"
              onClick={act(() => setSkillLevel(name, null))}
              className="w-full px-3 py-1.5 text-[12.5px] text-slate hover:bg-surface text-left border-t border-hairline-soft mt-1"
            >
              Go by my resume
            </button>
          )}
        </span>
      )}
    </span>
  );
}

function RemoveItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full px-3 py-1.5 text-[12.5px] text-poor hover:bg-surface text-left border-t border-hairline-soft mt-1"
    >
      {label}
    </button>
  );
}
