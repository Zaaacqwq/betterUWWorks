"use client";

import { useJobIdSet } from "./use-job-ids";

// Postings the student has kept, in this browser.
export function useSavedJobs() {
  const { ids, has, toggle, count } = useJobIdSet("buw-saved-jobs");
  return { savedIds: ids, isSaved: has, toggle, count };
}
