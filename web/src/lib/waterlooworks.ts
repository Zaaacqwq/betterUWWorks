export const WW_JOBS_URL = "https://waterlooworks.uwaterloo.ca/myAccount/co-op/full/jobs.htm";

// WaterlooWorks has no URL for a single posting: the list, a posting and its
// Apply all live on jobs.htm, and a posting opens through a POST. The
// extension reads this hash on arrival, searches WaterlooWorks for the id and
// opens the posting. The hash never reaches WaterlooWorks' server, and without
// the extension the link still lands on the job search.
export function postingUrl(jobId: string): string {
  return `${WW_JOBS_URL}#buw-open=${encodeURIComponent(jobId)}`;
}
