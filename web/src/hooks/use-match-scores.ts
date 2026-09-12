"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeProfile, UserInfo, MatchScore } from "@/lib/resume/types";
import { computeMatchScore } from "@/lib/resume/match-engine";
import type { JobForMatch } from "@/lib/resume/match-engine";
import type { SkillLevels } from "@/lib/resume/capability-utils";

interface JobWithId extends JobForMatch {
  jobId: string;
}

export function useMatchScores(
  profile: ResumeProfile | null,
  userInfo: UserInfo | null,
  jobs: JobWithId[],
  extraSkills?: string[],
  skillLevels?: SkillLevels
) {
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const computedRef = useRef<Set<string>>(new Set());
  const prevInvalidationKey = useRef("");

  const userInfoKey = useMemo(
    () => (userInfo ? JSON.stringify(userInfo) : ""),
    [userInfo]
  );

  const extraSkillsKey = useMemo(
    () =>
      (extraSkills?.length ? JSON.stringify(extraSkills) : "") +
      (skillLevels && Object.keys(skillLevels).length ? JSON.stringify(skillLevels) : ""),
    [extraSkills, skillLevels]
  );

  useEffect(() => {
    if (!profile) {
      setScores({});
      computedRef.current.clear();
      prevInvalidationKey.current = "";
      return;
    }

    const invalidationKey = (profile.extractedAt ?? "") + userInfoKey + extraSkillsKey;
    const needsReset = invalidationKey !== prevInvalidationKey.current;
    if (needsReset) {
      prevInvalidationKey.current = invalidationKey;
      computedRef.current.clear();
    }

    const newScores: Record<string, MatchScore> = {};
    let changed = false;

    for (const job of jobs) {
      const key = job.jobId;
      if (computedRef.current.has(key)) continue;

      newScores[key] = computeMatchScore(profile, userInfo, job, extraSkills, skillLevels);
      computedRef.current.add(key);
      changed = true;
    }

    if (changed || needsReset) {
      setScores(needsReset ? newScores : (prev) => ({ ...prev, ...newScores }));
    }
  }, [profile, userInfo, jobs, extraSkills, skillLevels, userInfoKey, extraSkillsKey]);

  const getScore = useCallback(
    (jobId: string): number | undefined => scores[jobId]?.score,
    [scores]
  );

  return { getScore, scores };
}
