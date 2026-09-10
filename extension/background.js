const DEFAULT_STATE = {
  status: "idle",
  statusText: "Ready. Navigate to WaterlooWorks job listings.",
  jobs: [],
  jobDetails: {},
  progress: { current: 0, total: 0, label: "" },
  tabId: null,
};

async function getState() {
  const result = await chrome.storage.local.get("buwState");
  return result.buwState || { ...DEFAULT_STATE };
}

async function setState(patch) {
  const state = await getState();
  Object.assign(state, patch);
  // Lets the popup tell a running scrape from one whose worker was reclaimed.
  state.lastTickAt = Date.now();
  await chrome.storage.local.set({ buwState: state });
  chrome.runtime.sendMessage({ source: "buw-bg", action: "state-update", state }).catch(() => {});
}

// Chrome freezes a background tab it considers idle, stopping its timers
// outright. The content script's waits are timer-driven, so they neither
// resolve nor reject, sendResponse is never called, and a message with no
// deadline parks the whole run on an await that can never return — which is
// what a scrape stopping partway with no errors recorded looked like.
const TAB_REPLY_TIMEOUT = 75000;

function toTab(tabId, action, payload, timeout = TAB_REPLY_TIMEOUT) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(
      () => finish({ error: true, timedOut: true, message: `page did not answer "${action}" in ${Math.round(timeout / 1000)}s (tab may be frozen — keep it the active tab)` }),
      timeout
    );

    chrome.tabs.sendMessage(tabId, { source: "buw-bg", action, payload }, (resp) => {
      if (chrome.runtime.lastError) {
        finish({ error: true, message: chrome.runtime.lastError.message });
        return;
      }
      finish(resp || { error: true, message: "No response" });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Chrome reclaims an idle MV3 service worker after 30 seconds. A scrape spends
// most of its time awaiting one message, and a backgrounded tab has its timers
// throttled hard — a 20s wait was measured taking 60s — so the gap between
// extension calls can pass that mark and the run dies mid-loop with the UI
// still claiming to be busy. Touching an extension API on a timer resets it.
let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20000);
}

function stopKeepAlive() {
  if (!keepAliveTimer) return;
  clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

// Reloading the extension tears down the content script in tabs that are
// already open, and the manifest only re-injects it on navigation, so the first
// message after a reload failed with "Receiving end does not exist". Inject on
// demand instead of asking for a page refresh.
async function ensureContentScript(tabId) {
  const alive = await toTab(tabId, "ping");
  if (!alive.error) return { ok: true };

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"],
    });
  } catch (err) {
    return { ok: false, message: `Cannot reach the page: ${err.message}` };
  }

  const retry = await toTab(tabId, "ping");
  if (retry.error) {
    return { ok: false, message: "Content script did not load. Reload the WaterlooWorks tab." };
  }
  return { ok: true };
}

async function waitWhilePaused() {
  while (true) {
    const s = await getState();
    if (s.status === "idle") return "cancelled";
    if (s.status !== "paused") return "resumed";
    await sleep(500);
  }
}

// === Scrape all pages ===
async function scrapeAllPages(tabId) {
  startKeepAlive();
  try {
    await scrapeAllPagesInner(tabId);
  } finally {
    stopKeepAlive();
  }
}

async function scrapeAllPagesInner(tabId) {
  await setState({ status: "scraping-list", statusText: "Starting...", jobs: [], jobDetails: {}, tabId });

  const ready = await ensureContentScript(tabId);
  if (!ready.ok) {
    await setState({ status: "error", statusText: ready.message });
    return;
  }

  await toTab(tabId, "click-first");
  await sleep(500);

  const allJobs = [];
  const seenIds = new Set();
  let page = 0;
  let duplicates = 0;
  let missingIds = 0;
  let incomplete = null;

  while (true) {
    const s = await getState();
    if (s.status === "idle") return;
    if (s.status === "paused") {
      const result = await waitWhilePaused();
      if (result === "cancelled") return;
    }

    page++;
    await setState({
      statusText: `Scraping page ${page}...`,
      progress: { current: allJobs.length, total: 0, label: `Page ${page} — ${allJobs.length} jobs so far` },
    });

    // A page whose rows we have all seen before means we read the table while
    // it was still showing the previous page, so the postings that belong here
    // were never captured. Re-read before moving on rather than losing them.
    let result = null;
    let fresh = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(1000);

      result = await toTab(tabId, "scrape-page");
      if (result.error) {
        await setState({ status: "error", statusText: "Error: " + result.message });
        return;
      }

      fresh = result.jobs.filter((job) => job.jobId && !seenIds.has(job.jobId));
      if (fresh.length > 0 || result.jobs.length === 0) break;
    }

    duplicates += result.jobs.length - fresh.length;
    missingIds += result.missingIds || 0;
    for (const job of fresh) seenIds.add(job.jobId);
    allJobs.push(...fresh);

    if (fresh.length === 0 && result.jobs.length > 0) {
      incomplete = `page ${page} never loaded`;
      break;
    }

    await setState({
      jobs: allJobs,
      progress: { current: allJobs.length, total: result.totalResults || allJobs.length, label: `Page ${page} — ${allJobs.length} jobs` },
    });

    const lastCheck = await toTab(tabId, "is-last-page");
    if (lastCheck.isLast) break;

    const nextResult = await toTab(tabId, "click-next");
    if (!nextResult.ok) {
      incomplete = `stopped at page ${page} (${nextResult.message || "navigation failed"})`;
      break;
    }
  }

  await toTab(tabId, "click-first");

  // Report what was actually captured. A silent count hid the fact that pages
  // were being re-read and postings dropped.
  const notes = [];
  if (duplicates > 0) notes.push(`${duplicates} duplicate row(s) skipped`);
  if (missingIds > 0) notes.push(`${missingIds} row(s) had no job id`);
  if (incomplete) notes.push(`incomplete: ${incomplete}`);

  await setState({
    status: incomplete ? "error" : "done",
    statusText:
      `Found ${allJobs.length} jobs from ${page} page(s).` +
      (notes.length > 0 ? ` (${notes.join("; ")})` : ""),
    jobs: allJobs,
    progress: { current: allJobs.length, total: allJobs.length, label: "Done" },
  });
}

// A detail counts as captured only if it actually carries fields. A run that
// read the viewer before its panels loaded stored objects holding nothing but
// a ratings chart; those are not errors, so treating "no _error" as done would
// have skipped them for good on the next pass.
function hasFields(detail) {
  if (!detail || detail._error) return false;
  return Object.keys(detail).some((k) => !k.startsWith("_"));
}

// === Scrape details ===
async function scrapeDetails(tabId) {
  startKeepAlive();
  try {
    await scrapeDetailsInner(tabId);
  } finally {
    stopKeepAlive();
  }
}

async function scrapeDetailsInner(tabId) {
  const state = await getState();
  const total = state.jobs.length;
  if (total === 0) return;

  const ready = await ensureContentScript(tabId);
  if (!ready.ok) {
    await setState({ status: "error", statusText: ready.message });
    return;
  }

  const jobDetails = state.jobDetails || {};
  const titles = new Map(state.jobs.map((j) => [j.jobId, j.title]));

  await setState({ status: "scraping-details", statusText: "Starting detail scrape...", tabId });

  await toTab(tabId, "click-first");

  let successCount = Object.keys(jobDetails).filter((id) => hasFields(jobDetails[id])).length;
  let seen = 0;
  let page = 0;
  let lastError = null;

  // Once the page has stopped answering there is nothing to be gained by
  // walking the rest of the list; stop and say so, since the run resumes from
  // wherever it got to.
  const FROZEN_LIMIT = 2;
  let frozenStreak = 0;

  const giveUp = async (why) =>
    setState({
      status: "error",
      statusText: `Stopped after ${successCount}/${total}: ${why}`,
      jobDetails,
      progress: { current: seen, total, label: "Stopped" },
    });

  while (true) {
    const cs = await getState();
    if (cs.status === "idle") return;
    if (cs.status === "paused" && (await waitWhilePaused()) === "cancelled") return;

    page++;

    // Take the ids from the page in front of us. The old code walked back to
    // page one and clicked forward for every page, then sliced the job list by
    // a hard-coded 50 — the list actually holds 48, so click-job was being
    // asked for rows that were never on screen and every job failed.
    const pageResult = await toTab(tabId, "scrape-page");
    if (pageResult.error) {
      await setState({ status: "error", statusText: "Error: " + pageResult.message });
      return;
    }

    for (const row of pageResult.jobs) {
      const inner = await getState();
      if (inner.status === "idle") return;
      if (inner.status === "paused" && (await waitWhilePaused()) === "cancelled") return;

      if (!row.jobId) continue;
      seen++;

      if (hasFields(jobDetails[row.jobId])) continue;

      await setState({
        statusText: `Page ${page} — ${seen}/${total}`,
        progress: {
          current: seen,
          total,
          label: `${seen}/${total}: ${titles.get(row.jobId) || row.title || row.jobId}`,
        },
      });

      const clickResult = await toTab(tabId, "click-job", { jobId: row.jobId });
      if (clickResult.error) {
        jobDetails[row.jobId] = { _error: clickResult.message };
        lastError = clickResult.message;
        await setState({ jobDetails });
        if (clickResult.timedOut && ++frozenStreak >= FROZEN_LIMIT) return giveUp(lastError);
        continue;
      }
      frozenStreak = 0;

      // No fixed delay: scrape-detail waits for the viewer to show this id.
      const detail = await toTab(tabId, "scrape-detail", { jobId: row.jobId });
      if (!detail || detail.error) {
        jobDetails[row.jobId] = { _error: detail?.message || "Failed" };
        lastError = detail?.message || "Failed";
        await setState({ jobDetails });
        if (detail?.timedOut && ++frozenStreak >= FROZEN_LIMIT) return giveUp(lastError);
        continue;
      }
      frozenStreak = 0;

      jobDetails[row.jobId] = detail.detail;

      const tabClick = await toTab(tabId, "click-ratings-tab");
      if (tabClick.ok) {
        await sleep(800);
        const ratingsResult = await toTab(tabId, "scrape-ratings");
        if (ratingsResult.ok && ratingsResult.ratings) {
          jobDetails[row.jobId]._workTermRatings = ratingsResult.ratings;
        }
        await toTab(tabId, "click-overview-tab");
        await sleep(300);
      }

      successCount++;
      await setState({ jobDetails });
    }

    const lastCheck = await toTab(tabId, "is-last-page");
    if (lastCheck.isLast) break;

    const nextResult = await toTab(tabId, "click-next");
    if (!nextResult.ok) {
      lastError = `stopped at page ${page}: ${nextResult.message || "navigation failed"}`;
      break;
    }
  }

  const failed = total - successCount;

  await setState({
    status: failed > 0 ? "error" : "done",
    statusText:
      `Done! ${successCount}/${total} details scraped.` +
      (lastError ? ` Last error: ${lastError}` : ""),
    jobDetails,
    progress: { current: total, total, label: "Complete" },
  });
}

// === Message handler ===
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.source !== "buw-popup-cmd") return false;

  switch (msg.action) {
    case "get-state":
      getState().then((s) => sendResponse(s));
      return true;

    case "start-scrape-list":
      scrapeAllPages(msg.tabId);
      sendResponse({ ok: true });
      return false;

    case "start-scrape-details":
      scrapeDetails(msg.tabId);
      sendResponse({ ok: true });
      return false;

    case "pause":
      setState({ status: "paused", statusText: "Paused." });
      sendResponse({ ok: true });
      return false;

    case "resume":
      getState().then((s) => {
        const detailCount = Object.keys(s.jobDetails || {}).length;
        const newStatus = detailCount > 0 ? "scraping-details" : "scraping-list";
        setState({ status: newStatus, statusText: "Resuming...", tabId: msg.tabId });
        sendResponse({ ok: true });
      });
      return true;

    case "cancel":
      setState({ status: "idle", statusText: "Cancelled." });
      sendResponse({ ok: true });
      return false;

    case "reset":
      chrome.storage.local.remove("buwState");
      sendResponse({ ok: true });
      return false;

    case "export":
      getState().then((s) => sendResponse({ jobs: s.jobs, jobDetails: s.jobDetails }));
      return true;

    default:
      return false;
  }
});
