/* global importScripts, syncToWebApp, rememberListUrl, startAutoRun, getAutoRun */
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

// Set when a write is refused — extension storage has a quota, and every write
// carries the whole detail set. Once it filled, every setState threw, so the
// run died where it stood and could not even record why: writing the error was
// itself a write. Never let that failure be silent again.
let storageError = null;

async function setState(patch) {
  const state = await getState();
  Object.assign(state, patch);
  // Lets the popup tell a running scrape from one whose worker was reclaimed.
  state.lastTickAt = Date.now();

  try {
    await chrome.storage.local.set({ buwState: state });
    storageError = null;
  } catch (err) {
    storageError = err?.message || String(err);
    console.error("[buw] could not save state:", storageError);
    return;
  }

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
    let timer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    timer = setTimeout(
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

// Which loop, if any, is running in this worker. The worker can be recycled at
// any time, taking the loop with it; the flag resets with it, which is exactly
// right — after a restart there is no loop, and resume has to start one.
let runningLoop = null;

// An interval cannot save a run on its own: it dies with the worker it lives
// in and has no way to bring it back. An alarm can — Chrome wakes the worker to
// deliver it — so the interval keeps a healthy worker from going idle and the
// alarm restarts the loop when one was reclaimed anyway.
const WATCHDOG = "buw-watchdog";

function startKeepAlive() {
  if (!keepAliveTimer) {
    keepAliveTimer = setInterval(() => {
      try {
        chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
      } catch {
        /* worker is going away; the alarm will bring the run back */
      }
    }, 20000);
  }
  chrome.alarms.create(WATCHDOG, { periodInMinutes: 0.5 });
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  chrome.alarms.clear(WATCHDOG);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== WATCHDOG) return;

  const state = await getState();
  const active = state.status === "scraping-list" || state.status === "scraping-details";

  // Paused is the user's decision, not a fault — leave it alone.
  if (!active) {
    chrome.alarms.clear(WATCHDOG);
    return;
  }
  if (runningLoop || !state.tabId) return;

  await setState({ statusText: "Picking the run back up after a restart..." });
  if (state.stage === "list") scrapeAllPages(state.tabId);
  else scrapeDetails(state.tabId);
});

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
  if (runningLoop) return;
  runningLoop = "list";
  startKeepAlive();
  try {
    await scrapeAllPagesInner(tabId);
  } finally {
    runningLoop = null;
    stopKeepAlive();
  }
}

async function scrapeAllPagesInner(tabId) {
  // Details are keyed by posting id and cost hours to gather, so a fresh list
  // keeps them: re-scraping the list used to throw every one away, and a term's
  // worth was one unlucky click from being lost. Postings that have since been
  // taken down are pruned once the new list is known.
  const carriedDetails = (await getState()).jobDetails || {};
  // The page this list came from is the one the daily run reopens.
  const listUrl = (await chrome.tabs.get(tabId).catch(() => null))?.url;

  await setState({ status: "scraping-list", stage: "list", statusText: "Starting...", jobs: [], capturedCount: null, tabId });

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
  const listedIds = new Set(allJobs.map((j) => j.jobId));
  const jobDetails = {};
  let keptDetails = 0;
  for (const [id, detail] of Object.entries(carriedDetails)) {
    if (listedIds.has(id)) {
      jobDetails[id] = detail;
      keptDetails++;
    }
  }

  const notes = [];
  if (keptDetails > 0) notes.push(`kept ${keptDetails} detail(s) already gathered`);
  if (duplicates > 0) notes.push(`${duplicates} duplicate row(s) skipped`);
  if (missingIds > 0) notes.push(`${missingIds} row(s) had no job id`);
  if (incomplete) notes.push(`incomplete: ${incomplete}`);

  if (!incomplete) await rememberListUrl(listUrl);

  await setState({
    status: incomplete ? "error" : "done",
    statusText:
      `Found ${allJobs.length} jobs from ${page} page(s).` +
      (notes.length > 0 ? ` (${notes.join("; ")})` : ""),
    jobs: allJobs,
    jobDetails,
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

// What the web app already holds. Details survive in the database once synced,
// so a run that lost its local copy — re-scraping the job list wipes it — has
// no reason to spend hours gathering them again.
async function fetchSyncedDetailIds() {
  const settings = await chrome.storage.local.get("buwSettings");
  const webUrl = (settings.buwSettings?.webUrl || "").replace(/\/+$/, "");
  if (!webUrl) {
    return { ids: new Set(), note: "no web app URL set, so nothing can be skipped" };
  }

  try {
    const headers = {};
    const apiKey = settings.buwSettings?.apiKey;
    if (apiKey) headers["x-api-key"] = apiKey;

    const resp = await fetch(`${webUrl}/api/jobs/with-detail`, { headers });
    if (!resp.ok) {
      return { ids: new Set(), note: `web app answered ${resp.status}, scraping everything` };
    }

    const result = await resp.json();
    const ids = new Set(result?.data?.jobIds || []);
    console.log(`[buw] web app already holds ${ids.size} detail(s)`);
    if (ids.size === 0) {
      return { ids, note: "web app holds no details yet, scraping everything" };
    }
    return { ids, note: null };
  } catch (err) {
    // Being unreachable is not a reason to refuse to scrape — but it does mean
    // hours of avoidable work, so it has to be said out loud rather than
    // quietly turning into a full re-scrape.
    console.error("[buw] could not ask the web app what it already has:", err);
    return { ids: new Set(), note: `web app unreachable (${err?.message || err}), scraping everything` };
  }
}

// === Scrape details ===
async function scrapeDetails(tabId) {
  if (runningLoop) return;
  runningLoop = "details";
  startKeepAlive();
  try {
    await scrapeDetailsInner(tabId);
  } finally {
    runningLoop = null;
    stopKeepAlive();
  }
}

async function scrapeDetailsInner(tabId) {
  const state = await getState();
  if (state.jobs.length === 0) return;

  const ready = await ensureContentScript(tabId);
  if (!ready.ok) {
    await setState({ status: "error", statusText: ready.message });
    return;
  }

  const jobDetails = state.jobDetails || {};
  const { ids: alreadySynced, note: skipNote } = await fetchSyncedDetailIds();
  const knownJobs = state.jobs.slice();
  const titles = new Map(knownJobs.map((j) => [j.jobId, j.title]));
  let total = knownJobs.length;

  await setState({
    status: "scraping-details",
    stage: "details",
    statusText: skipNote
      ? `Starting — ${skipNote}`
      : `Starting — ${alreadySynced.size} already in the web app, skipping those`,
    tabId,
  });

  await toTab(tabId, "click-first");

  // A posting the web app already holds is captured, wherever the bytes sit.
  // Counting only the local copy made a run that had 2098 of 2170 in hand open
  // at zero and quote an hour and a half of work it was not going to do.
  const captured = new Set(
    Object.keys(jobDetails).filter((id) => hasFields(jobDetails[id]))
  );
  for (const job of knownJobs) {
    if (alreadySynced.has(job.jobId)) captured.add(job.jobId);
  }
  let successCount = captured.size;
  let page = 0;
  let lastError = null;

  // Once the page has stopped answering there is nothing to be gained by
  // walking the rest of the list; stop and say so, since the run resumes from
  // wherever it got to.
  const FROZEN_LIMIT = 2;
  let frozenStreak = 0;
  let walkedWholeList = false;

  const giveUp = async (why) =>
    setState({
      status: "error",
      statusText: `Stopped after ${successCount}/${total}: ${why}`,
      jobDetails,
      progress: { current: successCount, total, label: "Stopped" },
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

    // Resuming walks back over every page already covered, and rows that are
    // done are skipped without a word. With no state written for a whole page
    // the popup sat on the first page's count and its stall check, which reads
    // the same heartbeat, called a working run dead.
    const pending = pageResult.jobs.filter(
      (j) => j.jobId && !hasFields(jobDetails[j.jobId]) && !alreadySynced.has(j.jobId)
    );
    const pageLabel = pageResult.pageNumber ? `Page ${pageResult.pageNumber}` : `Page ${page}`;
    await setState({
      statusText:
        (pending.length === 0
          ? `${pageLabel} — all ${pageResult.jobs.length} already captured, moving on`
          : `${pageLabel} — ${pending.length} to fetch`) + (skipNote ? ` · ${skipNote}` : ""),
      progress: { current: successCount, total, label: pageLabel },
    });

    // Whatever page we end up looking at after a pause, the ids gathered above
    // may belong to a page that is no longer shown — signing back in drops the
    // list to page one — so re-read rather than clicking for rows that moved.
    let rescanPage = false;

    for (const row of pageResult.jobs) {
      const inner = await getState();
      if (inner.status === "idle") return;
      if (inner.status === "paused") {
        if ((await waitWhilePaused()) === "cancelled") return;
        rescanPage = true;
        break;
      }

      if (!row.jobId) continue;

      // The list on screen is live: postings added since the list was scraped
      // show up here. Fold them in rather than fetching a detail that has no
      // job to belong to — the sync payload is built from this list, so those
      // were being thrown away, and they made the tally read more details than
      // jobs.
      if (!titles.has(row.jobId)) {
        knownJobs.push(row);
        titles.set(row.jobId, row.title);
        total = knownJobs.length;
        if (alreadySynced.has(row.jobId)) {
          captured.add(row.jobId);
          successCount = captured.size;
        }
        await setState({ jobs: knownJobs });
      }

      if (hasFields(jobDetails[row.jobId]) || alreadySynced.has(row.jobId)) continue;

      if (storageError) {
        return giveUp(`extension storage refused the write (${storageError}) — press Sync to web app, then Reset`);
      }

      // Progress counts postings captured, not rows walked past. Walking the
      // list again after signing back in revisits everything already done, and
      // counting those made the bar claim 69% while two thirds of the postings
      // still had nothing.
      await setState({
        statusText: `${pageLabel} — ${successCount}/${total} captured` + (skipNote ? ` · ${skipNote}` : ""),
        progress: {
          current: successCount,
          total,
          label: `${titles.get(row.jobId) || row.title || row.jobId}`,
        },
      });

      const clickResult = await toTab(tabId, "click-job", { jobId: row.jobId });
      if (clickResult.error) {
        jobDetails[row.jobId] = { _error: clickResult.message };
        lastError = clickResult.message;
        await setState({ jobDetails });
        if (clickResult.loggedOut) return giveUp(clickResult.message);
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
        if (detail?.loggedOut) return giveUp(detail.message);
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

      captured.add(row.jobId);
      successCount = captured.size;
      await setState({ jobDetails, capturedCount: successCount });
    }

    if (rescanPage) {
      page--;
      await setState({ statusText: "Resumed — re-reading the page that is showing..." });
      continue;
    }

    const lastCheck = await toTab(tabId, "is-last-page");
    if (lastCheck.isLast) {
      walkedWholeList = true;
      break;
    }

    await setState({ statusText: `${pageLabel} done — turning the page...` });
    const nextResult = await toTab(tabId, "click-next");
    if (!nextResult.ok) {
      lastError = `stopped at page ${page}: ${nextResult.message || "navigation failed"}`;
      break;
    }
  }

  // A detail can outlive its posting: a job taken down between runs leaves an
  // entry no page will ever show again. It cannot be synced — the payload is
  // built from the job list — so it only inflates the count and takes up room.
  // Only safe once the whole list has been walked; a run that stopped early has
  // simply not reached those rows yet.
  let dropped = 0;
  if (walkedWholeList) {
    const known = new Set(knownJobs.map((j) => j.jobId));
    for (const id of Object.keys(jobDetails)) {
      if (!known.has(id)) {
        delete jobDetails[id];
        dropped++;
      }
    }
    successCount = knownJobs.filter(
      (j) => hasFields(jobDetails[j.jobId]) || alreadySynced.has(j.jobId)
    ).length;
  }

  const shortfall = total - successCount;

  await setState({
    // A posting with nothing to scrape is not a failure. Only an actual error
    // should colour the run red, or every finished run ends looking broken.
    status: lastError ? "error" : "done",
    statusText:
      `Done! ${successCount}/${total} details scraped.` +
      (shortfall > 0 ? ` ${shortfall} had none to fetch.` : "") +
      (dropped > 0 ? ` (${dropped} for postings no longer listed were dropped)` : "") +
      (lastError ? ` Last error: ${lastError}` : ""),
    jobDetails,
    capturedCount: successCount,
    progress: { current: successCount, total, label: "Complete" },
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
      // Pressing this after a stall has to be able to take over a run whose
      // worker is gone but whose stored status still says paused or running.
      getState().then((s) => {
        if (s.status === "paused") setState({ status: "scraping-details" });
        scrapeDetails(msg.tabId);
      });
      sendResponse({ ok: true });
      return false;

    case "pause":
      setState({ status: "paused", statusText: "Paused." });
      sendResponse({ ok: true });
      return false;

    case "resume":
      getState().then((s) => {
        const stage = s.stage || (Object.keys(s.jobDetails || {}).length > 0 ? "details" : "list");
        setState({
          status: stage === "details" ? "scraping-details" : "scraping-list",
          statusText: "Resuming...",
          tabId: msg.tabId,
        });
        // Resume used to only flip the status and trust a paused loop to notice.
        // If the worker had been recycled meanwhile there was no loop left to
        // read it, and the run sat on "Resuming..." forever.
        if (!runningLoop) {
          if (stage === "details") scrapeDetails(msg.tabId);
          else scrapeAllPages(msg.tabId);
        }
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

    case "sync":
      syncToWebApp().then(sendResponse);
      return true;

    case "run-now":
      startAutoRun("manual").then(sendResponse);
      return true;

    case "autorun-status":
      getAutoRun().then(sendResponse);
      return true;

    default:
      return false;
  }
});

// Last, so everything above is defined before these run: they share this
// worker's global scope and call into it.
importScripts("sync.js", "autorun.js");
