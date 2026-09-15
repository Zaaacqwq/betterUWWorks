import { countPending, runPending } from "@/lib/extraction/runner";
import { embedPendingLines } from "./embed-run";
import { kick } from "./grader";
import { lineExtractor } from "./tag-run";

// Everything in lib/line-check runs inside the web server's own process, so a
// restart (a deploy, a reboot) drops it mid-way. On start, pick it all up
// again: postings still to split and tag, every student's checks, and lines
// still waiting for their vectors. Nothing here is waited for.

const START_DELAY_MS = 10_000;

export function resumeBackgroundWork(): void {
  setTimeout(() => {
    void (async () => {
      try {
        kick();
        const waiting = await countPending(lineExtractor);
        if (waiting > 0) await runPending(lineExtractor, waiting);
        await embedPendingLines();
      } catch (err) {
        console.error("[line-check] resuming background work failed:", err);
      }
    })();
  }, START_DELAY_MS);
}
