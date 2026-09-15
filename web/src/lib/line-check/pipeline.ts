import { embedPendingLines } from "./embed-run";
import { kick } from "./grader";

// What happens once postings have fresh lines: every student's queue is looked
// at again, and the new lines get their vectors. Tagging calls this for each
// posting it finishes; a burst of them is taken a few seconds at a time, so a
// long backfill feeds the checks as it goes rather than only at its end.

const GATHER_MS = 5000;
let timer: ReturnType<typeof setTimeout> | null = null;

export function linesChanged(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    kick();
    void embedPendingLines().catch((err) => console.error("[line-check] embedding failed:", err));
  }, GATHER_MS);
}
