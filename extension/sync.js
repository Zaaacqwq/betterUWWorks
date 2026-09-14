/* exported syncToWebApp */
/* global getState */
// Sends every scraped posting to the web app. It lives in the worker rather
// than the popup so the daily run can sync with the popup shut; the popup's
// button asks the worker to do it. A posting sent without a detail keeps the
// one the database already holds (api/jobs/import).
async function syncToWebApp() {
  const settings = (await chrome.storage.local.get("buwSettings")).buwSettings || {};
  const webUrl = (settings.webUrl || "").replace(/\/+$/, "");
  if (!webUrl) {
    return { ok: false, needsSettings: true, error: "Add the web app URL in Settings, then sync again." };
  }

  const state = await getState();
  if (!state.jobs?.length) return { ok: false, error: "Nothing to sync yet — scrape the job list first." };

  const payload = {
    jobs: state.jobs.map((job) => ({ ...job, detail: state.jobDetails?.[job.jobId] || null })),
    batchId: new Date().toISOString(),
  };
  const headers = { "Content-Type": "application/json" };
  if (settings.apiKey) headers["x-api-key"] = settings.apiKey;

  let resp;
  let result;
  try {
    resp = await fetch(`${webUrl}/api/jobs/import`, { method: "POST", headers, body: JSON.stringify(payload) });
    result = await resp.json().catch(() => null);
  } catch (err) {
    return { ok: false, error: `Couldn't reach the web app at ${webUrl} (${err?.message || err}). Is it running?` };
  }

  if (resp.ok && result?.success) {
    return { ok: true, imported: result.data.imported, sent: payload.jobs.length };
  }
  console.error("[buw] sync failed", resp.status, result);
  const detail = Array.isArray(result?.details)
    ? result.details
        .slice(0, 3)
        .map((d) => `${(d.path || []).join(".")}: ${d.message}`)
        .join("; ")
    : "";
  const why = resp.status === 403 ? "the API key in Settings doesn't match the web app's" : result?.error || resp.statusText;
  return { ok: false, error: `Sync failed: ${why}${detail ? ` — ${detail}` : ""}` };
}
