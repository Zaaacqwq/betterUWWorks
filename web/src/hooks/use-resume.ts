"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ResumeProfile, ResumeMeta, SkillLevel, UserInfo } from "@/lib/resume/types";
import type { SkillLevels } from "@/lib/resume/capability-utils";
import { normalizeSkill } from "@/lib/resume/skill-utils";
import { migrateProfile } from "@/lib/resume/migrate-profile";

const KEYS = {
  text: "buw-resume-raw",
  // Which of the student's resumes this browser is showing, and the list of
  // them as the server last described it.
  id: "buw-resume-id",
  list: "buw-resumes",
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

export interface ResumeSummary {
  id: string;
  label: string | null;
  fileName: string | null;
  active: boolean;
  version: number;
  updatedAt: string;
  checked: number;
}

interface ResumeState {
  text: string | null;
  resumes: ResumeSummary[];
  activeId: string | null;
  profile: ResumeProfile | null;
  meta: ResumeMeta | null;
  userInfo: UserInfo | null;
  extraSkills: string[];
  skillLevels: SkillLevels;
}

const EMPTY_SKILLS: string[] = [];
const EMPTY_RESUMES: ResumeSummary[] = [];
const EMPTY_LEVELS: SkillLevels = {};
const EMPTY_STATE: ResumeState = {
  text: null,
  resumes: EMPTY_RESUMES,
  activeId: null,
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
    (localStorage.getItem(KEYS.skillLevels) ?? "") +
    (localStorage.getItem(KEYS.list) ?? "") +
    (localStorage.getItem(KEYS.id) ?? "");
  if (raw !== cacheKey) {
    cacheKey = raw;
    const rawProfile = readJSON<Record<string, unknown>>(KEYS.profile);
    cached = {
      text: localStorage.getItem(KEYS.text),
      resumes: readJSON<ResumeSummary[]>(KEYS.list) ?? EMPTY_RESUMES,
      activeId: localStorage.getItem(KEYS.id),
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

// --- Keeping the server's copy in step --------------------------------------
// The server keeps the signed-in student's resume so their postings can be
// checked while they are away and it follows them to another browser. Every
// change here is sent there shortly after; on load, whichever side changed
// last wins: unsent edits in this browser, otherwise the server's copy.

const SYNC_KEYS = { dirty: "buw-resume-dirty", syncedAt: "buw-resume-synced-at", asNew: "buw-resume-as-new" } as const;
const PUSH_DELAY_MS = 1200;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const pushListeners = new Set<() => void>();

/** Called after the server has taken a change, so scores can be fetched again. */
export function onResumePushed(cb: () => void): () => void {
  pushListeners.add(cb);
  return () => pushListeners.delete(cb);
}

function pushed() {
  pushListeners.forEach((cb) => cb());
}

function schedulePush() {
  localStorage.setItem(SYNC_KEYS.dirty, "1");
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushResume();
  }, PUSH_DELAY_MS);
}

interface ServerResume {
  id: string;
  label: string | null;
  text: string;
  fileName: string | null;
  profile: ResumeProfile | null;
  userInfo: UserInfo | null;
  extraSkills: string[];
  skillLevels: SkillLevels;
  version: number;
  updatedAt: string;
}

interface ServerLibrary {
  active: ServerResume | null;
  resumes: ResumeSummary[];
}

async function pushResume(): Promise<void> {
  const text = localStorage.getItem(KEYS.text);
  const profile = readJSON<ResumeProfile>(KEYS.profile);
  // A resume still being read is sent once its profile is in.
  if (!text || text.trim().length < 50 || !profile) return;
  // Uploaded with "Add another", this becomes a resume of its own rather than
  // saving over the one in use.
  const asNew = localStorage.getItem(SYNC_KEYS.asNew) === "1";
  try {
    const res = await fetch("/api/resume", {
      method: asNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        fileName: readJSON<ResumeMeta>(KEYS.meta)?.fileName ?? null,
        profile,
        userInfo: readJSON<UserInfo>(KEYS.userInfo),
        extraSkills: readJSON<string[]>(KEYS.extraSkills) ?? [],
        skillLevels: readJSON<SkillLevels>(KEYS.skillLevels) ?? {},
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) return;
    localStorage.removeItem(SYNC_KEYS.dirty);
    localStorage.removeItem(SYNC_KEYS.asNew);
    localStorage.setItem(SYNC_KEYS.syncedAt, json.data.updatedAt);
    localStorage.setItem(KEYS.id, json.data.id);
    await refreshLibrary();
    pushed();
  } catch {
    // Offline or signed out: the edit stays marked unsent and goes next time.
  }
}

/** Writes the resume in use into this browser, as the pages read it. */
function applyServerResume(server: ServerResume) {
  const prevMeta = readJSON<ResumeMeta>(KEYS.meta);
  const sameText = localStorage.getItem(KEYS.text) === server.text;
  localStorage.setItem(KEYS.text, server.text);
  localStorage.setItem(KEYS.id, server.id);
  if (server.profile) localStorage.setItem(KEYS.profile, JSON.stringify(server.profile));
  else localStorage.removeItem(KEYS.profile);
  if (!sameText || !prevMeta) {
    const meta: ResumeMeta = {
      fileName: server.fileName,
      uploadedAt: server.updatedAt,
      contentHash: simpleHash(server.text),
      profileVersion: (prevMeta?.profileVersion ?? 0) + 1,
    };
    localStorage.setItem(KEYS.meta, JSON.stringify(meta));
  }
  // Details, added skills and levels belong to the resume, so they follow it —
  // including when the resume being switched to has none of its own.
  if (server.userInfo) localStorage.setItem(KEYS.userInfo, JSON.stringify(server.userInfo));
  else localStorage.removeItem(KEYS.userInfo);
  localStorage.setItem(KEYS.extraSkills, JSON.stringify(server.extraSkills ?? []));
  localStorage.setItem(KEYS.skillLevels, JSON.stringify(server.skillLevels ?? {}));
  localStorage.setItem(SYNC_KEYS.syncedAt, server.updatedAt);
  localStorage.removeItem(SYNC_KEYS.dirty);
}

async function fetchLibrary(): Promise<ServerLibrary | null> {
  const res = await fetch("/api/resume");
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) return null;
  return json.data as ServerLibrary;
}

/** Brings the list of resumes, and the one in use, up to date in this browser. */
async function refreshLibrary(hydrate = false): Promise<ServerLibrary | null> {
  const library = await fetchLibrary();
  if (!library) return null;
  localStorage.setItem(KEYS.list, JSON.stringify(library.resumes));
  if (hydrate) {
    if (library.active) applyServerResume(library.active);
    else clearLocalResume();
  }
  notify();
  return library;
}

function clearLocalResume() {
  localStorage.removeItem(KEYS.text);
  localStorage.removeItem(KEYS.profile);
  localStorage.removeItem(KEYS.meta);
  localStorage.removeItem(KEYS.id);
  localStorage.removeItem("buw-match-cache");
  localStorage.removeItem(SYNC_KEYS.dirty);
  localStorage.removeItem(SYNC_KEYS.syncedAt);
  localStorage.removeItem(SYNC_KEYS.asNew);
}

let synced = false;

/** Brings this browser and the server into step, once per page load. */
export async function syncResumeWithServer(): Promise<void> {
  if (synced) return;
  synced = true;
  try {
    const library = await fetchLibrary();
    if (!library) return;
    localStorage.setItem(KEYS.list, JSON.stringify(library.resumes));
    notify();
    const server = library.active;
    const localText = localStorage.getItem(KEYS.text);

    // Edits made here that never reached the server win; otherwise the server's
    // copy does, so another browser's changes and switches follow.
    if (localStorage.getItem(SYNC_KEYS.dirty) || (!server && localText)) {
      await pushResume();
      return;
    }
    if (!server || server.updatedAt === localStorage.getItem(SYNC_KEYS.syncedAt)) {
      if (server) localStorage.setItem(KEYS.id, server.id);
      return;
    }
    applyServerResume(server);
    notify();
    pushed();
  } catch {
    synced = false;
  }
}

/** The next resume uploaded is kept alongside the others instead of replacing. */
export function startNewResume(): void {
  localStorage.setItem(SYNC_KEYS.asNew, "1");
}

export async function switchResume(id: string): Promise<void> {
  const res = await fetch(`/api/resume/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ use: true }),
  });
  if (!res.ok) return;
  await refreshLibrary(true);
  pushed();
}

export async function renameResume(id: string, label: string): Promise<void> {
  await fetch(`/api/resume/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  await refreshLibrary();
}

export async function removeResume(id: string): Promise<void> {
  const res = await fetch(`/api/resume/${id}`, { method: "DELETE" });
  if (!res.ok) return;
  await refreshLibrary(true);
  pushed();
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
    schedulePush();
  }, []);

  const setProfile = useCallback((profile: ResumeProfile) => {
    localStorage.setItem(KEYS.profile, JSON.stringify(profile));
    notify();
    schedulePush();
  }, []);

  const setUserInfo = useCallback((info: UserInfo) => {
    localStorage.setItem(KEYS.userInfo, JSON.stringify(info));
    notify();
    schedulePush();
  }, []);

  const setExtraSkills = useCallback((skills: string[]) => {
    localStorage.setItem(KEYS.extraSkills, JSON.stringify(skills));
    notify();
    schedulePush();
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
    schedulePush();
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
    schedulePush();
  }, []);

  const removeSkill = useCallback((name: string) => {
    const key = normalizeSkill(name);
    const skills = (readJSON<string[]>(KEYS.extraSkills) ?? []).filter((s) => normalizeSkill(s) !== key);
    const levels = { ...(readJSON<SkillLevels>(KEYS.skillLevels) ?? {}) };
    delete levels[key];
    localStorage.setItem(KEYS.extraSkills, JSON.stringify(skills));
    localStorage.setItem(KEYS.skillLevels, JSON.stringify(levels));
    notify();
    schedulePush();
  }, []);

  const clearResume = useCallback(() => {
    localStorage.removeItem(KEYS.list);
    clearLocalResume();
    if (pushTimer) clearTimeout(pushTimer);
    notify();
    // Every resume on the server, and every check made against them, go too.
    void fetch("/api/resume", { method: "DELETE" })
      .then(() => pushed())
      .catch(() => {});
  }, []);

  return {
    resumeText: state.text,
    resumes: state.resumes,
    activeResumeId: state.activeId,
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
    startNewResume,
    switchResume,
    renameResume,
    removeResume,
  };
}
