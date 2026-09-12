import type { ResumeProfile, UserInfo, MatchScore, MatchDebug, SkillSource } from "./types";
import type { PostingDetails } from "@/lib/job-details/types";
import { computeSkillOverlap } from "./skill-utils";
import { applySkillLevels, buildCapabilityMap, computeWeightedOverlap, extraSkillsToCapabilities, type SkillLevels } from "./capability-utils";
import { programFit, requirementWarnings } from "./requirement-checks";

export interface JobForMatch {
  level: string | null;
  requiredSkills: string | null;
  jobSummary: string | null;
  specialRequirements: string | null;
  aiSkills: string[] | null;
  // Pay and requirements read out of the posting; null until they have been.
  aiDetails?: PostingDetails | null;
  hiresByWorkTermNumber: Record<string, number> | null;
}

export function computeMatchScore(
  profile: ResumeProfile,
  userInfo: UserInfo | null,
  job: JobForMatch,
  extraSkills?: string[],
  skillLevels?: SkillLevels
): MatchScore {
  const skillsResult = scoreSkills(profile, job, extraSkills, skillLevels);
  const levelResult = scoreLevel(profile, userInfo, job);
  const programResult = programFit(userInfo, job.aiDetails);
  const warnings = requirementWarnings(userInfo, job.aiDetails);

  const debug: MatchDebug = {
    skills: skillsResult.debug,
    level: levelResult.debug,
    program: programResult.debug,
  };

  return {
    score: Math.round(skillsResult.score + levelResult.score + programResult.score),
    breakdown: {
      skills: Math.round(skillsResult.score),
      level: Math.round(levelResult.score),
      program: Math.round(programResult.score),
    },
    warnings,
    debug,
  };
}

function scoreSkills(profile: ResumeProfile, job: JobForMatch, extraSkills?: string[], skillLevels?: SkillLevels) {
  const { skills: jobSkills, source } = resolveJobSkills(job);

  if (jobSkills.length === 0) {
    return {
      score: 0,
      debug: {
        source,
        jobSkills: [] as string[],
        matched: [] as MatchDebug["skills"]["matched"],
        missing: [] as string[],
        overlap: 0,
      },
    };
  }

  if (profile.capabilities && profile.capabilities.length > 0) {
    const allCaps = applySkillLevels(
      [...profile.capabilities, ...extraSkillsToCapabilities(extraSkills ?? [])],
      skillLevels
    );
    const capMap = buildCapabilityMap(allCaps);
    const result = computeWeightedOverlap(capMap, jobSkills);

    return {
      score: result.overlap * 70,
      debug: {
        source,
        jobSkills,
        matched: result.matched,
        missing: result.missing,
        overlap: result.overlap,
      },
    };
  }

  const allResumeSkills = [
    ...profile.skills,
    ...(extraSkills ?? []).map((name) => ({ name, proficiency: "intermediate" as const })),
  ];
  const result = computeSkillOverlap(allResumeSkills, jobSkills);

  return {
    score: result.overlap * 70,
    debug: {
      source,
      jobSkills,
      matched: result.matched.map((s) => ({
        skill: s,
        confidence: 1,
        evidenceType: "explicit" as const,
        weight: 1,
      })),
      missing: result.missing,
      overlap: result.overlap,
    },
  };
}

// A posting's skills come only from the model's extraction, checked against
// the posting before being stored. There is deliberately no keyword fallback
// while that is pending: a word list both misses anything it has never heard of
// and finds skills that are not there ("the next generation" read as Next.js).
function resolveJobSkills(job: JobForMatch): { skills: string[]; source: SkillSource } {
  if (job.aiSkills == null) return { skills: [], source: "pending" };
  return { skills: job.aiSkills, source: "ai" };
}

const TERM_KEYS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth +"] as const;

function scoreLevel(profile: ResumeProfile, userInfo: UserInfo | null, job: JobForMatch) {
  const coopNum = userInfo?.coopTermNumber ?? profile.coopTermCount;
  const userTermKey = TERM_KEYS[Math.min(coopNum - 1, 5)] ?? "First";
  const hires = job.hiresByWorkTermNumber;

  if (hires && typeof hires === "object") {
    const total = Object.values(hires).reduce((a, b) => a + b, 0);
    if (total > 0) {
      const userTermHires = hires[userTermKey] ?? 0;
      const pct = userTermHires / total;

      const adjacentKeys = TERM_KEYS.filter((_, i) => Math.abs(i - (coopNum - 1)) === 1);
      const adjacentHires = adjacentKeys.reduce((sum, k) => sum + (hires[k] ?? 0), 0);
      const adjacentPct = adjacentHires / total;

      const score = Math.min(15, (pct + adjacentPct * 0.3) * 15 / 0.5);

      const topTerm = Object.entries(hires).sort(([, a], [, b]) => b - a)[0];
      return {
        score,
        debug: {
          jobLevel: job.level,
          userCoopTerm: coopNum,
          historyMatch: `Your term (${userTermKey}): ${Math.round(pct * 100)}% of hires · Top: ${topTerm[0]} (${Math.round((topTerm[1] / total) * 100)}%)`,
        },
      };
    }
  }

  if (!job.level) {
    return {
      score: 8,
      debug: { jobLevel: null, userCoopTerm: coopNum, historyMatch: null },
    };
  }

  const userTier = coopNumberToTier(coopNum);
  const jobTier = levelToTier(job.level);
  const diff = Math.abs(jobTier - userTier);
  const score = diff === 0 ? 15 : diff === 1 ? 9 : 3;

  return {
    score,
    debug: {
      jobLevel: job.level,
      userCoopTerm: coopNum,
      historyMatch: `Tier match: ${tierLabel(userTier)} vs ${tierLabel(jobTier)}`,
    },
  };
}

function levelToTier(level: string): number {
  const lower = level.toLowerCase();
  if (lower.includes("senior")) return 3;
  if (lower.includes("intermediate")) return 2;
  return 1;
}

function coopNumberToTier(coopNum: number): number {
  if (coopNum >= 4) return 3;
  if (coopNum >= 2) return 2;
  return 1;
}

const TIER_LABELS = ["", "Junior", "Intermediate", "Senior"] as const;
export function tierLabel(tier: number): string {
  return TIER_LABELS[tier] ?? "Unknown";
}
