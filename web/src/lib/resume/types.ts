export type EvidenceType = "work_used" | "project_used" | "explicit" | "inferred" | "weak_inferred";

export interface Capability {
  name: string;
  category: SkillCategory;
  evidenceSource: string;
  evidenceType: EvidenceType;
  confidence: number;
  reasoning: string;
}

export interface ResumeProfile {
  skills: Skill[];
  capabilities: Capability[];
  profileSchema: number;
  education: Education[];
  experience: Experience[];
  coopTermCount: number;
  programs: string[];
  preferredLocations: string[];
  preferredArrangement: string | null;
  preferredDuration: string | null;
  summary: string;
  extractedAt: string;
}

export interface Skill {
  name: string;
  category: SkillCategory;
  proficiency: "beginner" | "intermediate" | "advanced";
}

export type SkillCategory =
  | "programming_language"
  | "framework"
  | "tool"
  | "database"
  | "cloud"
  | "soft_skill"
  | "domain"
  | "other";

export interface Education {
  institution: string;
  program: string;
  degree: string;
  yearLevel: number;
}

export interface Experience {
  title: string;
  company: string;
  duration: string;
  skills: string[];
  type: "coop" | "internship" | "fulltime" | "project" | "other";
}

export interface ResumeMeta {
  fileName: string | null;
  uploadedAt: string;
  contentHash: string;
  profileVersion: number;
}

export interface UserInfo {
  coopTermNumber: number;
  gpa: number | null;
  yearLevel: number | null;
  program: string;
}

export interface QualificationWarning {
  type: "gpa" | "coop_term" | "program" | "year_level";
  message: string;
}

export interface MatchedSkillInfo {
  skill: string;
  confidence: number;
  evidenceType: EvidenceType;
  weight: number;
}

export interface MatchDebug {
  skills: {
    source: "ai" | "regex";
    jobSkills: string[];
    matched: MatchedSkillInfo[];
    missing: string[];
    overlap: number;
  };
  level: {
    jobLevel: string | null;
    userCoopTerm: number;
    historyMatch: string | null;
  };
  program: {
    userProgram: string;
    jobMentionsProgram: boolean;
    matched: boolean;
  };
}

export interface MatchScore {
  score: number;
  breakdown: {
    skills: number;
    level: number;
    program: number;
  };
  warnings: QualificationWarning[];
  debug: MatchDebug;
}

export interface DetailedMatch {
  score: number;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}
