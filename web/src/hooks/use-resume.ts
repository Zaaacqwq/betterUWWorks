"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ResumeProfile, ResumeMeta, SkillLevel, UserInfo } from "@/lib/resume/types";
import type { SkillLevels } from "@/lib/resume/capability-utils";
import { normalizeSkill } from "@/lib/resume/skill-utils";
import { migrateProfile } from "@/lib/resume/migrate-profile";

const KEYS = {
  text: "buw-resume-raw",
  profile: "buw-resume-profile",
  meta: "buw-resume-meta",
  userInfo: "buw-user-info",
  extraSkills: "buw-extra-skills",
  skillLevels: "buw-skill-levels",
} as const;

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  for (const cb of listeners) cb();
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

interface ResumeState {
  text: string | null;
  profile: ResumeProfile | null;
  meta: ResumeMeta | null;
  userInfo: UserInfo | null;
  extraSkills: string[];
  skillLevels: SkillLevels;
}

const EMPTY_SKILLS: string[] = [];
const EMPTY_LEVELS: SkillLevels = {};
const EMPTY_STATE: ResumeState = {
  text: null,
  profile: null,
  meta: null,
  userInfo: null,
  extraSkills: EMPTY_SKILLS,
  skillLevels: EMPTY_LEVELS,
};

let cached: ResumeState = EMPTY_STATE;
let cacheKey = "";

function getSnapshot(): ResumeState {
  const raw =
    (localStorage.getItem(KEYS.text) ?? "") +
    (localStorage.getItem(KEYS.profile) ?? "") +
    (localStorage.getItem(KEYS.meta) ?? "") +
    (localStorage.getItem(KEYS.userInfo) ?? "") +
    (localStorage.getItem(KEYS.extraSkills) ?? "") +
    (localStorage.getItem(KEYS.skillLevels) ?? "");
  if (raw !== cacheKey) {
    cacheKey = raw;
    const rawProfile = readJSON<Record<string, unknown>>(KEYS.profile);
    cached = {
      text: localStorage.getItem(KEYS.text),
      profile: rawProfile ? migrateProfile(rawProfile) : null,
      meta: readJSON<ResumeMeta>(KEYS.meta),
      userInfo: readJSON<UserInfo>(KEYS.userInfo),
      extraSkills: readJSON<string[]>(KEYS.extraSkills) ?? EMPTY_SKILLS,
      skillLevels: readJSON<SkillLevels>(KEYS.skillLevels) ?? EMPTY_LEVELS,
    };
  }
  return cached;
}

function getServerSnapshot(): ResumeState {
  return EMPTY_STATE;
}

export function useResume() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setResume = useCallback((text: string, fileName?: string) => {
    const prevMeta = readJSON<ResumeMeta>(KEYS.meta);
    const meta: ResumeMeta = {
      fileName: fileName ?? null,
      uploadedAt: new Date().toISOString(),
      contentHash: simpleHash(text),
      profileVersion: (prevMeta?.profileVersion ?? 0) + 1,
    };
    localStorage.setItem(KEYS.text, text);
    localStorage.setItem(KEYS.meta, JSON.stringify(meta));
    localStorage.removeItem(KEYS.profile);
    notify();
  }, []);

  const setProfile = useCallback((profile: ResumeProfile) => {
    localStorage.setItem(KEYS.profile, JSON.stringify(profile));
    notify();
  }, []);

  const setUserInfo = useCallback((info: UserInfo) => {
    localStorage.setItem(KEYS.userInfo, JSON.stringify(info));
    notify();
  }, []);

  const setExtraSkills = useCallback((skills: string[]) => {
    localStorage.setItem(KEYS.extraSkills, JSON.stringify(skills));
    notify();
  }, []);

  // How well the student knows a skill, from their resume or not. null clears
  // the level, back to what the resume evidence says.
  const setSkillLevel = useCallback((name: string, level: SkillLevel | null) => {
    const levels = { ...(readJSON<SkillLevels>(KEYS.skillLevels) ?? {}) };
    const key = normalizeSkill(name);
    if (level) levels[key] = level;
    else delete levels[key];
    localStorage.setItem(KEYS.skillLevels, JSON.stringify(levels));
    notify();
  }, []);

  // Adds a skill the resume doesn't show, at the level the student picks.
  const addSkill = useCallback((name: string, level: SkillLevel) => {
    const skills = readJSON<string[]>(KEYS.extraSkills) ?? [];
    const key = normalizeSkill(name);
    if (!skills.some((s) => normalizeSkill(s) === key)) {
      localStorage.setItem(KEYS.extraSkills, JSON.stringify([...skills, name.trim()]));
    }
    const levels = { ...(readJSON<SkillLevels>(KEYS.skillLevels) ?? {}), [key]: level };
    localStorage.setItem(KEYS.skillLevels, JSON.stringify(levels));
    notify();
  }, []);

  const removeSkill = useCallback((name: string) => {
    const key = normalizeSkill(name);
    const skills = (readJSON<string[]>(KEYS.extraSkills) ?? []).filter((s) => normalizeSkill(s) !== key);
    const levels = { ...(readJSON<SkillLevels>(KEYS.skillLevels) ?? {}) };
    delete levels[key];
    localStorage.setItem(KEYS.extraSkills, JSON.stringify(skills));
    localStorage.setItem(KEYS.skillLevels, JSON.stringify(levels));
    notify();
  }, []);

  const clearResume = useCallback(() => {
    localStorage.removeItem(KEYS.text);
    localStorage.removeItem(KEYS.profile);
    localStorage.removeItem(KEYS.meta);
    localStorage.removeItem("buw-match-cache");
    notify();
  }, []);

  return {
    resumeText: state.text,
    profile: state.profile,
    meta: state.meta,
    userInfo: state.userInfo,
    extraSkills: state.extraSkills,
    skillLevels: state.skillLevels,
    hasResume: state.text != null,
    hasProfile: state.profile != null,
    setResume,
    setProfile,
    setUserInfo,
    setExtraSkills,
    setSkillLevel,
    addSkill,
    removeSkill,
    clearResume,
  };
}
