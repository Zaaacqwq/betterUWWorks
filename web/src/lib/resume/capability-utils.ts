import type { Capability, EvidenceType, MatchedSkillInfo, SkillLevel } from "./types";
import { normalizeSkill } from "./skill-utils";
import { expandSkill } from "./skill-utils";

const EVIDENCE_MULTIPLIERS: Record<EvidenceType, number> = {
  work_used: 1.0,
  project_used: 1.0,
  explicit: 1.0,
  inferred: 0.7,
  weak_inferred: 0.4,
};

// A level the student set outweighs what the resume suggests: someone who
// says they only know a listed skill a little gets half credit for it.
export const LEVEL_WEIGHT: Record<SkillLevel, number> = { proficient: 1, familiar: 0.5 };

export function effectiveWeight(capability: Capability): number {
  if (capability.level) return LEVEL_WEIGHT[capability.level];
  const multiplier = EVIDENCE_MULTIPLIERS[capability.evidenceType] ?? 0.6;
  return capability.confidence * multiplier;
}

// Skill levels the student has set, keyed by normalizeSkill(name).
export type SkillLevels = Record<string, SkillLevel>;

export function applySkillLevels(capabilities: Capability[], levels: SkillLevels | undefined): Capability[] {
  if (!levels || Object.keys(levels).length === 0) return capabilities;
  return capabilities.map((c) => {
    const level = levels[normalizeSkill(c.name)];
    return level ? { ...c, level } : c;
  });
}

export function buildCapabilityMap(capabilities: Capability[]): Map<string, Capability> {
  const map = new Map<string, Capability>();

  for (const cap of capabilities) {
    for (const expanded of expandSkill(cap.name)) {
      const key = normalizeSkill(expanded);
      const existing = map.get(key);
      if (!existing || effectiveWeight(cap) > effectiveWeight(existing)) {
        map.set(key, cap);
      }
    }
  }

  return map;
}

export function extraSkillsToCapabilities(extraSkills: string[]): Capability[] {
  return extraSkills.map((name) => ({
    name,
    category: "other" as const,
    evidenceSource: "User-added skill",
    evidenceType: "explicit" as const,
    confidence: 1.0,
    reasoning: "Manually added by user",
  }));
}

export interface WeightedOverlapResult {
  overlap: number;
  matched: MatchedSkillInfo[];
  missing: string[];
}

export function computeWeightedOverlap(
  capabilityMap: Map<string, Capability>,
  jobSkills: string[]
): WeightedOverlapResult {
  if (jobSkills.length === 0) return { overlap: 1, matched: [], missing: [] };

  let weightSum = 0;
  const matched: MatchedSkillInfo[] = [];
  const missing: string[] = [];

  for (const js of jobSkills) {
    const expanded = expandSkill(js);
    let found = false;

    for (const part of expanded) {
      const key = normalizeSkill(part);
      const cap = capabilityMap.get(key);
      if (cap) {
        const w = effectiveWeight(cap);
        weightSum += Math.min(w, 1);
        matched.push({
          skill: js,
          confidence: cap.confidence,
          evidenceType: cap.evidenceType,
          weight: w,
          ...(cap.level && { level: cap.level }),
        });
        found = true;
        break;
      }
    }

    if (!found) {
      missing.push(js);
    }
  }

  return {
    overlap: Math.min(1, weightSum / jobSkills.length),
    matched,
    missing,
  };
}
