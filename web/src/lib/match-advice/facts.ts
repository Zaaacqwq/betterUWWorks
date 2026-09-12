import type { PostingDetails, RequirementKind } from "@/lib/job-details/types";
import { buildCapabilityMap, extraSkillsToCapabilities } from "@/lib/resume/capability-utils";
import { normalizeSkill } from "@/lib/resume/skill-utils";
import type { MatchScore, ResumeProfile, UserInfo } from "@/lib/resume/types";

// The facts the advice is built from, all worked out before the model sees
// anything: which of the posting's skills the student has and where on their
// resume, which they don't, what they've done, and what to check first.

export interface MatchedSkillFact {
  skill: string;
  // Where on the resume it shows: "Experience: SWE @ Shopify".
  evidence: string;
  // The student says they've only used it a little.
  familiar: boolean;
}

export interface ExperienceFact {
  // Numbered from 1, for the model to point at.
  id: number;
  label: string;
  skills: string[];
}

export interface AdviceFacts {
  matched: MatchedSkillFact[];
  missing: string[];
  experiences: ExperienceFact[];
  checks: string[];
}

const MAX_EXPERIENCES = 12;

export function experienceFacts(profile: ResumeProfile): ExperienceFact[] {
  return (profile.experience ?? []).slice(0, MAX_EXPERIENCES).map((e, i) => ({
    id: i + 1,
    label: [e.title, e.company].filter(Boolean).join(" · "),
    skills: e.skills ?? [],
  }));
}

function matchedFacts(profile: ResumeProfile, score: MatchScore, extraSkills: string[]): MatchedSkillFact[] {
  const capabilities = buildCapabilityMap([...(profile.capabilities ?? []), ...extraSkillsToCapabilities(extraSkills)]);
  return score.debug.skills.matched.map((m) => ({
    skill: m.skill,
    evidence: capabilities.get(normalizeSkill(m.skill))?.evidenceSource ?? "Resume",
    // Known only a little, or only through a related skill: not one to lead with.
    familiar: m.level === "familiar" || m.via !== undefined,
  }));
}

// Requirements that decide whether a student can take the job, and whether
// what the student has told us already settles them.
const UNLESS_CONFIRMED: Partial<Record<RequirementKind, (info: UserInfo | null) => boolean>> = {
  citizenship: (info) => info?.citizenOrPermanentResident === true,
  drivers_licence: (info) => info?.hasDriversLicence === true,
};
const ALWAYS_CHECK: RequirementKind[] = ["security_clearance", "us_work_authorization", "consecutive_terms", "language"];

export function eligibilityChecks(
  details: PostingDetails | null,
  userInfo: UserInfo | null,
  score: MatchScore
): string[] {
  const checks = score.warnings.map((w) => w.message);
  for (const r of details?.requirements ?? []) {
    if (!r.required) continue;
    const settled = UNLESS_CONFIRMED[r.kind];
    if (settled ? !settled(userInfo) && !score.warnings.some((w) => w.type === r.kind) : ALWAYS_CHECK.includes(r.kind)) {
      checks.push(r.summary);
    }
  }
  return [...new Set(checks)];
}

export function adviceFacts(
  profile: ResumeProfile,
  userInfo: UserInfo | null,
  extraSkills: string[],
  details: PostingDetails | null,
  score: MatchScore
): AdviceFacts {
  return {
    matched: matchedFacts(profile, score, extraSkills),
    missing: score.debug.skills.missing,
    experiences: experienceFacts(profile),
    checks: eligibilityChecks(details, userInfo, score),
  };
}
