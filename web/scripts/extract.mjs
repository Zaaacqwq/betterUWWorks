// Catches up on one kind of model extraction by calling the running app until
// nothing is left. Imports extract their own postings; this is for a backfill,
// or with --redo for re-running every posting after a prompt or check changes.
//
//   node scripts/extract.mjs <skills|details> [--redo | --redo=<ISO time>] [--url http://localhost:3000]
//
// --redo re-extracts every posting extracted before now. An interrupted redo
// is resumed with the time it printed when it started, so postings it already
// did are not paid for twice. Sends API_KEY as x-api-key when it is set, as
// the import does.

const KINDS = { skills: "extract-skills", details: "extract-details" };
const args = process.argv.slice(2);
const kind = args.find((a) => a in KINDS);
if (!kind) {
  console.error(`Usage: node scripts/extract.mjs <${Object.keys(KINDS).join("|")}> [--redo | --redo=<ISO time>]`);
  process.exit(1);
}
const baseUrl = args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://localhost:3000";
const redoArg = args.find((a) => a === "--redo" || a.startsWith("--redo="));
const olderThan = redoArg
  ? (redoArg.includes("=") ? new Date(redoArg.split("=")[1]) : new Date()).toISOString()
  : undefined;
if (olderThan) console.log(`Re-extracting postings extracted before ${olderThan} (resume with: node scripts/extract.mjs ${kind} --redo=${olderThan})`);
const BATCH = 50;
const WAIT_FOR_OTHER_RUN_MS = 10_000;
const MAX_IDLE_BATCHES = 30;

const headers = { "content-type": "application/json" };
if (process.env.API_KEY) headers["x-api-key"] = process.env.API_KEY;

let processed = 0;
let failed = 0;
let idleBatches = 0;

for (;;) {
  const res = await fetch(`${baseUrl}/api/jobs/${KINDS[kind]}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ limit: BATCH, olderThan }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    console.error(`Request failed (${res.status}):`, body?.error ?? "no response body");
    process.exit(1);
  }

  const { data } = body;
  processed += data.processed;
  failed += data.failed;
  console.log(`+${data.processed} extracted, ${data.failed} failed, ${data.remaining} remaining`);
  for (const f of data.failures) console.log(`  ${f.jobId}: ${f.reason}`);

  if (data.remaining === 0) break;
  // Every posting in the batch failed: carrying on would only fail them again.
  if (data.processed === 0 && data.failed > 0) {
    console.error("A whole batch failed; stopping. The failures above say why.");
    process.exit(1);
  }
  if (data.processed === 0) {
    // Nothing failed, but nothing was read: an import is reading these right
    // now, or just queued new ones. Give it a moment, but not forever.
    if (++idleBatches > MAX_IDLE_BATCHES) {
      console.error(`Nothing could be read for ${MAX_IDLE_BATCHES} batches in a row; stopping.`);
      process.exit(1);
    }
    console.log(`  ${data.skipped} being read by another run; waiting`);
    await new Promise((resolve) => setTimeout(resolve, WAIT_FOR_OTHER_RUN_MS));
    continue;
  }
  idleBatches = 0;
}

console.log(`Done: ${processed} extracted, ${failed} failed.`);
