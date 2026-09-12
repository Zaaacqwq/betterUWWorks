import { checkMention, contextSupportsSkill, displayName, foldText, mentionSupportsSkill } from "@/lib/job-skills/verify";
import { normalizeSkill } from "./skill-utils";
import type { Capability, Experience } from "./types";

// A skill the parser says is written on the resume has to come with the
// resume's own words for it, checked the way a posting's skills are. One that
// doesn't pass is kept only as a suggestion ("inferred"), which counts toward
// matches once the student confirms it — so a resume is never credited with a
// skill it doesn't show.

const WRITTEN: Capability["evidenceType"][] = ["work_used", "project_used", "explicit"];

export interface RawCapability extends Capability {
  mention: string | null;
}

export interface CapabilityVerification {
  capabilities: Capability[];
  downgraded: string[];
}

function strip({ mention: _mention, ...capability }: RawCapability): Capability {
  void _mention;
  return capability;
}

export function verifyCapabilities(raw: RawCapability[], resumeText: string): CapabilityVerification {
  const folded = foldText(resumeText);
  const downgraded: string[] = [];

  const capabilities = raw.map((cap) => {
    if (!WRITTEN.includes(cap.evidenceType)) return strip(cap);
    const mention = cap.mention?.trim();
    const found = mention && checkMention(folded, mention) === "found";
    if (found && (mentionSupportsSkill(cap.name, mention) || contextSupportsSkill(folded, cap.name, mention))) {
      return strip(cap);
    }
    downgraded.push(cap.name);
    return {
      ...strip(cap),
      evidenceType: "inferred" as const,
      confidence: Math.min(cap.confidence, 0.6),
      reasoning: found
        ? `The resume says "${displayName(mention)}", not ${cap.name} as such`
        : "Not found written on the resume",
    };
  });

  return { capabilities, downgraded };
}

// An experience's skills, cut to the ones the resume was shown to have, so
// advice built on an experience never leans on a skill it doesn't show.
export function verifiedExperience(experience: Experience[], capabilities: Capability[]): Experience[] {
  const written = new Set(capabilities.filter((c) => WRITTEN.includes(c.evidenceType)).map((c) => normalizeSkill(c.name)));
  return experience.map((e) => ({
    ...e,
    skills: (Array.isArray(e.skills) ? e.skills : []).filter((s) => typeof s === "string" && written.has(normalizeSkill(s))),
  }));
}
