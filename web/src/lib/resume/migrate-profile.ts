import type { Capability, ResumeProfile } from "./types";

export function migrateProfile(raw: Record<string, unknown>): ResumeProfile {
  const profile = raw as unknown as Partial<ResumeProfile>;

  if (profile.capabilities && profile.capabilities.length > 0 && (profile.profileSchema ?? 0) >= 2) {
    return profile as ResumeProfile;
  }

  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const capabilities: Capability[] = skills.map((s) => ({
    name: s.name,
    category: s.category ?? "other",
    evidenceSource: "Skills section",
    evidenceType: "explicit" as const,
    confidence: 1.0,
    reasoning: "Listed in skills section (legacy migration)",
  }));

  return {
    ...(profile as ResumeProfile),
    capabilities,
    profileSchema: 2,
  };
}
