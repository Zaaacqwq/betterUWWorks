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

  await toTab(tabId, "click-first");
  await sleep(500);

  const allJobs = [];
  let page = 0;

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

    const result = await toTab(tabId, "scrape-page");
    if (result.error) {
      await setState({ status: "error", statusText: "Error: " + result.message });
      return;
    }

    allJobs.push(...result.jobs);
    await setState({
      jobs: allJobs,
      progress: { current: allJobs.length, total: result.totalResults || allJobs.length, label: `Page ${page} — ${allJobs.length} jobs` },
    });

    const lastCheck = await toTab(tabId, "is-last-page");
    if (lastCheck.isLast) break;

    const nextResult = await toTab(tabId, "click-next");
    if (!nextResult.ok) break;
  }

  await toTab(tabId, "click-first");

  await setState({
    status: "done",
    statusText: `Found ${allJobs.length} jobs from ${page} page(s).`,
    jobs: allJobs,
    progress: { current: allJobs.length, total: allJobs.length, label: "Done" },
  });
}

// === Scrape details ===
async function scrapeDetails(tabId) {
  const state = await getState();
  const jobs = state.jobs;
  if (jobs.length === 0) return;

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

      const detail = await toTab(tabId, "scrape-detail");
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
