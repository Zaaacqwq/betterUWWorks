"use client";

import { useJobIdSet } from "./use-job-ids";

// Postings the student has turned down. They are left out of the list until
// the student asks to see them, the way saved ones are shown on their own.
export function useHiddenJobs() {
  const { ids, has, toggle, count } = useJobIdSet("buw-hidden-jobs");
  return { hiddenIds: ids, isHidden: has, toggle, count };
}
