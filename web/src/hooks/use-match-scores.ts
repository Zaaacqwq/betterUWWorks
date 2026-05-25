"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeProfile, UserInfo, MatchScore } from "@/lib/resume/types";
import { computeMatchScore } from "@/lib/resume/match-engine";
import type { JobForMatch } from "@/lib/resume/match-engine";

interface JobWithId extends JobForMatch {
  jobId: string;
}

export function useMatchScores(
  profile: ResumeProfile | null,
  userInfo: UserInfo | null,
  jobs: JobWithId[],
  extraSkills?: string[]
) {
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const computedRef = useRef<Set<string>>(new Set());
  const prevInvalidationKey = useRef("");

  const userInfoKey = useMemo(
    () => (userInfo ? JSON.stringify(userInfo) : ""),
    [userInfo]
  );

  const extraSkillsKey = useMemo(
    () => (extraSkills?.length ? JSON.stringify(extraSkills) : ""),
    [extraSkills]
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

      newScores[key] = computeMatchScore(profile, userInfo, job, extraSkills);
      computedRef.current.add(key);
      changed = true;
    }

    if (changed || needsReset) {
      setScores(needsReset ? newScores : (prev) => ({ ...prev, ...newScores }));
    }
  }, [profile, userInfo, jobs, extraSkills, userInfoKey, extraSkillsKey]);

  const getScore = useCallback(
    (jobId: string): number | undefined => scores[jobId]?.score,
    [scores]
  );

  return { getScore, scores };
}
