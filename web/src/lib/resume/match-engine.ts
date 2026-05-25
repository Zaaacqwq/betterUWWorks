import type { ResumeProfile, UserInfo, MatchScore, MatchDebug, QualificationWarning } from "./types";
import { extractSkillsFromText, computeSkillOverlap } from "./skill-utils";
import { buildCapabilityMap, computeWeightedOverlap, extraSkillsToCapabilities } from "./capability-utils";

export interface JobForMatch {
  level: string | null;
  requiredSkills: string | null;
  jobSummary: string | null;
  specialRequirements: string | null;
  aiSkills: string[] | null;
  hiresByWorkTermNumber: Record<string, number> | null;
}

export function computeMatchScore(
  profile: ResumeProfile,
  userInfo: UserInfo | null,
  job: JobForMatch,
  extraSkills?: string[]
): MatchScore {
  const skillsResult = scoreSkills(profile, job, extraSkills);
  const levelResult = scoreLevel(profile, userInfo, job);
  const programResult = scoreProgram(userInfo, job);
  const warnings = extractWarnings(userInfo, job);

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

function scoreSkills(profile: ResumeProfile, job: JobForMatch, extraSkills?: string[]) {
  const { skills: jobSkills, source } = resolveJobSkills(job);

  if (jobSkills.length === 0) {
    return {
      score: 0,
      debug: {
        source: source as "ai" | "regex",
        jobSkills: [] as string[],
        matched: [] as MatchDebug["skills"]["matched"],
        missing: [] as string[],
        overlap: 0,
      },
    };
  }

  if (profile.capabilities && profile.capabilities.length > 0) {
    const allCaps = [
      ...profile.capabilities,
      ...extraSkillsToCapabilities(extraSkills ?? []),
    ];
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

function resolveJobSkills(job: JobForMatch): { skills: string[]; source: "ai" | "regex" } {
  if (job.aiSkills && job.aiSkills.length > 0) {
    return { skills: job.aiSkills, source: "ai" };
  }
  const text = [job.requiredSkills, job.jobSummary].filter(Boolean).join(" ");
  if (!text) return { skills: [], source: "regex" };
  return { skills: extractSkillsFromText(text), source: "regex" };
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

function scoreProgram(userInfo: UserInfo | null, job: JobForMatch) {
  if (!userInfo?.program) {
    return {
      score: 8,
      debug: { userProgram: "", jobMentionsProgram: false, matched: false },
    };
  }

  const reqText = job.specialRequirements?.toLowerCase() ?? "";
  const mentions = mentionsProgram(reqText);

  if (!mentions) {
    return {
      score: 10,
      debug: { userProgram: userInfo.program, jobMentionsProgram: false, matched: false },
    };
  }

  const userProg = userInfo.program.toLowerCase();
  if (reqText.includes(userProg)) {
    return {
      score: 15,
      debug: { userProgram: userInfo.program, jobMentionsProgram: true, matched: true },
    };
  }

  for (const alias of getProgramAliases(userProg)) {
    if (reqText.includes(alias)) {
      return {
        score: 15,
        debug: { userProgram: userInfo.program, jobMentionsProgram: true, matched: true },
      };
    }
  }

  return {
    score: 3,
    debug: { userProgram: userInfo.program, jobMentionsProgram: true, matched: false },
  };
}

function extractWarnings(
  userInfo: UserInfo | null,
  job: JobForMatch
): QualificationWarning[] {
  if (!userInfo) return [];

  const warnings: QualificationWarning[] = [];
  const req = job.specialRequirements?.toLowerCase() ?? "";
  if (!req) return warnings;

  if (userInfo.gpa != null) {
    const gpaMatch = req.match(/(?:gpa|grade point average)\s*(?:of\s*)?(\d+\.?\d*)/i);
    if (gpaMatch) {
      const requiredGpa = parseFloat(gpaMatch[1]);
      if (userInfo.gpa < requiredGpa) {
        warnings.push({
          type: "gpa",
          message: `Requires GPA ${requiredGpa}+, yours is ${userInfo.gpa}`,
        });
      }
    }
  }

  const termMatch = req.match(/(\d+)(?:st|nd|rd|th)\s*(?:co-?op|work\s*term)/i);
  if (termMatch) {
    const requiredTerm = parseInt(termMatch[1], 10);
    if (userInfo.coopTermNumber < requiredTerm) {
      warnings.push({
        type: "coop_term",
        message: `Requires co-op term ${requiredTerm}+, you are on term ${userInfo.coopTermNumber}`,
      });
    }
  }

  if (userInfo.yearLevel != null) {
    const yearMatch = req.match(/(\d+)[AB]?\s*(?:or higher|and above|\+)/i);
    if (yearMatch) {
      const requiredYear = parseInt(yearMatch[1], 10);
      if (userInfo.yearLevel < requiredYear) {
        warnings.push({
          type: "year_level",
          message: `Prefers year ${requiredYear}+, you are in year ${userInfo.yearLevel}`,
        });
      }
    }
  }

  return warnings;
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

function mentionsProgram(text: string): boolean {
  const keywords = [
    "computer science", "engineering", "mathematics", "math",
    "business", "science", "arts", "accounting", "finance",
    "statistics", "physics", "chemistry", "biology", "economics",
    "program", "degree", "discipline", "faculty", "enrolled in",
  ];
  return keywords.some((k) => text.includes(k));
}

const PROGRAM_ALIASES: Record<string, string[]> = {
  "computer science": ["cs", "comp sci", "computing"],
  "computer engineering": ["ce", "comp eng"],
  "software engineering": ["se", "swe"],
  "electrical engineering": ["ee", "ece"],
  "mechanical engineering": ["me", "mech eng"],
  "systems design engineering": ["syde"],
  "management engineering": ["msci"],
  "mathematics": ["math", "applied math"],
  "statistics": ["stats", "stat"],
  "data science": ["data sci"],
  "business administration": ["bba", "business"],
  "accounting and financial management": ["afm"],
  "information technology management": ["itm"],
};

function getProgramAliases(program: string): string[] {
  for (const [canonical, aliases] of Object.entries(PROGRAM_ALIASES)) {
    if (program.includes(canonical) || aliases.some((a) => program.includes(a))) {
      return [canonical, ...aliases];
    }
  }
  return [];
}
