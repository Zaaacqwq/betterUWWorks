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
  await chrome.storage.local.set({ buwState: state });
  chrome.runtime.sendMessage({ source: "buw-bg", action: "state-update", state }).catch(() => {});
}

function toTab(tabId, action, payload) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { source: "buw-bg", action, payload }, (resp) => {
      if (chrome.runtime.lastError) {
        resolve({ error: true, message: chrome.runtime.lastError.message });
        return;
      }
      resolve(resp || { error: true, message: "No response" });
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

// === Scrape details ===
async function scrapeDetails(tabId) {
  const state = await getState();
  const jobs = state.jobs;
  if (jobs.length === 0) return;

  const ready = await ensureContentScript(tabId);
  if (!ready.ok) {
    await setState({ status: "error", statusText: ready.message });
    return;
  }

  const jobDetails = state.jobDetails || {};
  const alreadyDone = Object.keys(jobDetails).filter((id) => !jobDetails[id]._error).length;

  await setState({ status: "scraping-details", statusText: "Starting detail scrape...", tabId });

  const pageSize = 50;
  const totalPages = Math.ceil(jobs.length / pageSize);
  let successCount = alreadyDone;

  for (let page = 0; page < totalPages; page++) {
    await setState({ statusText: `Navigating to page ${page + 1}/${totalPages}...` });
    await toTab(tabId, "click-first");
    await sleep(300);
    for (let p = 0; p < page; p++) {
      await toTab(tabId, "click-next");
    }
    await sleep(500);

    const pageJobs = jobs.slice(page * pageSize, (page + 1) * pageSize);

    for (let i = 0; i < pageJobs.length; i++) {
      // Check for pause/cancel
      const cs = await getState();
      if (cs.status === "idle") return;
      if (cs.status === "paused") {
        const result = await waitWhilePaused();
        if (result === "cancelled") return;
        // After resume, re-navigate to current page
        await toTab(tabId, "click-first");
        await sleep(300);
        for (let p = 0; p < page; p++) {
          await toTab(tabId, "click-next");
        }
        await sleep(500);
      }

      const job = pageJobs[i];
      if (!job.jobId) continue;
      if (jobDetails[job.jobId] && !jobDetails[job.jobId]._error) continue;

      const globalIdx = page * pageSize + i + 1;
      await setState({
        statusText: `Page ${page + 1}/${totalPages} — job ${i + 1}/${pageJobs.length}`,
        progress: { current: globalIdx, total: jobs.length, label: `${globalIdx}/${jobs.length}: ${job.title}` },
      });

      const clickResult = await toTab(tabId, "click-job", { jobId: job.jobId });
      if (clickResult.error) {
        jobDetails[job.jobId] = { _error: clickResult.message };
        continue;
      }

      await sleep(1000);

      const detail = await toTab(tabId, "scrape-detail", { jobId: job.jobId });
      if (detail && !detail.error) {
        jobDetails[job.jobId] = detail.detail;

        // Try to scrape Work Term Ratings tab
        const tabClick = await toTab(tabId, "click-ratings-tab");
        if (tabClick.ok) {
          await sleep(800);
          const ratingsResult = await toTab(tabId, "scrape-ratings");
          if (ratingsResult.ok && ratingsResult.ratings) {
            jobDetails[job.jobId]._workTermRatings = ratingsResult.ratings;
          }
          await toTab(tabId, "click-overview-tab");
          await sleep(300);
        }

        successCount++;
      } else {
        jobDetails[job.jobId] = { _error: detail?.message || "Failed" };
      }

      await setState({ jobDetails });

      await toTab(tabId, "close-modal");
      await sleep(400);
    }
  }

  await setState({
    status: "done",
    statusText: `Done! ${successCount}/${jobs.length} details scraped.`,
    jobDetails,
    progress: { current: jobs.length, total: jobs.length, label: "Complete" },
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
