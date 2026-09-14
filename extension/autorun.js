/* exported rememberListUrl, startAutoRun, getAutoRun */
/* global getState, sleep, toTab, ensureContentScript, scrapeAllPages, scrapeDetails, fetchSyncedDetailIds, syncToWebApp, runningLoop */
// The daily run: open the job list, scrape it, scrape the new postings' details,
// sync, and say how it went. Chrome can reclaim this worker at any moment, so
// the run is a set of steps recorded in storage rather than one long await: a
// one-minute alarm calls advance(), which picks up from whatever step is
// recorded. The scrape loops themselves already survive a restart (see the
// watchdog in background.js); this only has to notice when they finish.

const DAILY_ALARM = "buw-daily";
const CATCH_UP_ALARM = "buw-catch-up";
const TICK_ALARM = "buw-autorun-tick";

const WW_ORIGIN = "https://waterlooworks.uwaterloo.ca";
// The "Students/Alumni/Staff" button on the WaterlooWorks landing page. While
// the UW sign-in is still remembered this lands straight back in WaterlooWorks.
const SSO_LOGIN_URL = `${WW_ORIGIN}/waterloo.htm?action=login`;

const DEFAULT_RUN_TIME = "06:00";
const DAY_MS = 24 * 60 * 60 * 1000;
// How long a sign-in that needs nobody is given before asking for a person.
const SILENT_SIGN_IN_MS = 3 * 60 * 1000;
const SIGN_IN_GIVE_UP_MS = 12 * 60 * 60 * 1000;
const PAGE_LOAD_MS = 60 * 1000;
const TABLE_WAIT_MS = 30 * 1000;
// A run recorded as in progress for longer than this was lost with the browser.
const STALE_RUN_MS = SIGN_IN_GIVE_UP_MS + 60 * 60 * 1000;
const NTFY_SERVER = "https://ntfy.sh";

async function getAutoRun() {
  return (await chrome.storage.local.get("buwAutoRun")).buwAutoRun || {};
}

async function setAutoRun(patch) {
  const next = { ...(await getAutoRun()), ...patch };
  await chrome.storage.local.set({ buwAutoRun: next });
  return next;
}

async function getSettings() {
  return (await chrome.storage.local.get("buwSettings")).buwSettings || {};
}

// Pushes a message to the owner's phone through ntfy. JSON publishing, because
// header-based titles cannot carry anything but Latin-1.
async function notify(title, message, priority = 3) {
  const topic = ((await getSettings()).ntfyTopic || "").trim();
  if (!topic) return;
  try {
    await fetch(NTFY_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, title, message, priority, tags: priority >= 4 ? ["warning"] : ["briefcase"] }),
    });
  } catch (err) {
    console.error("[buw] could not send a notification:", err);
  }
}

function isSignedIn(url) {
  return typeof url === "string" && url.startsWith(`${WW_ORIGIN}/myAccount/`);
}

// The job list the owner last scraped by hand: the daily run reopens it.
async function rememberListUrl(url) {
  if (isSignedIn(url)) await setAutoRun({ listUrl: url });
}

// === Scheduling ===
function nextRunAt(time, now = Date.now()) {
  const [h, m] = (/^\d{1,2}:\d{2}$/.test(time || "") ? time : DEFAULT_RUN_TIME).split(":").map(Number);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  if (at.getTime() <= now) at.setDate(at.getDate() + 1);
  return at.getTime();
}

// Alarms are not guaranteed to outlive a browser restart, so this runs on every
// start as well as whenever the settings change.
async function scheduleDaily() {
  const settings = await getSettings();
  if (!settings.autoRun) {
    await chrome.alarms.clear(DAILY_ALARM);
    await chrome.alarms.clear(CATCH_UP_ALARM);
    return;
  }
  chrome.alarms.create(DAILY_ALARM, {
    when: nextRunAt(settings.autoRunTime),
    periodInMinutes: 24 * 60,
  });
}

// A Mac that was off or asleep at run time catches up shortly after Chrome
// starts, once its tabs have come back.
async function catchUpIfOverdue() {
  const settings = await getSettings();
  const run = await getAutoRun();
  if (!settings.autoRun || run.phase) return;
  if (Date.now() - (run.lastSuccessAt || 0) > DAY_MS) {
    chrome.alarms.create(CATCH_UP_ALARM, { when: Date.now() + 2 * 60 * 1000 });
  }
}

// === The run ===
async function startAutoRun(trigger) {
  const run = await getAutoRun();
  if (run.phase && Date.now() - (run.startedAt || 0) < STALE_RUN_MS) {
    return { ok: false, error: "A daily run is already going." };
  }
  const state = await getState();
  if (runningLoop || state.status === "scraping-list" || state.status === "scraping-details" || state.status === "paused") {
    return { ok: false, error: "A scrape is already in progress — let it finish first." };
  }
  if (!run.listUrl) {
    const why = "No job list to open yet. Open the WaterlooWorks job list and press Scrape job list once; the daily run reopens that page.";
    await setAutoRun({ lastRun: { at: Date.now(), ok: false, message: why } });
    await notify("WaterlooWorks daily run can't start", why, 4);
    return { ok: false, error: why };
  }

  // Without the web app's list every posting looks new: hours of scraping,
  // and a sync that would be refused for the same reason. Stop and say so.
  const before = await fetchSyncedDetailIds();
  if (!before.ok) {
    const why = `Can't ask the web app what it already has: ${before.note.replace(/, scraping everything$/, "")}. Fix the Web app URL or API key in Settings.`;
    await setAutoRun({ lastRun: { at: Date.now(), ok: false, message: why } });
    await notify("WaterlooWorks daily run can't start", why, 4);
    return { ok: false, error: why };
  }
  await setAutoRun({
    phase: "open",
    afterOpen: "list",
    trigger,
    startedAt: Date.now(),
    signInStartedAt: null,
    signInNotified: false,
    detailsError: null,
    beforeCount: before.ids.size,
  });
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  advance();
  return { ok: true };
}

async function finishAutoRun(ok, message) {
  const now = Date.now();
  const run = await getAutoRun();
  await setAutoRun({
    phase: null,
    lastRun: { at: now, ok, message },
    lastSuccessAt: ok ? now : run.lastSuccessAt || null,
  });
  await chrome.alarms.clear(TICK_ALARM);
  await notify(ok ? "WaterlooWorks synced" : "WaterlooWorks daily run failed", message, ok ? 2 : 4);
}

function waitForTabLoad(tabId, timeout = PAGE_LOAD_MS) {
  return new Promise((resolve) => {
    let timer = null;
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") finish(true);
    };
    function finish(value) {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(value);
    }
    timer = setTimeout(() => finish(false), timeout);
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function getTab(tabId) {
  if (!tabId) return null;
  return chrome.tabs.get(tabId).catch(() => null);
}

// Loads a page in the run's tab, opening one if it has gone, and keeps it the
// tab on show: Chrome freezes background tabs, and the scrape runs in this one.
async function loadInRunTab(url) {
  const run = await getAutoRun();
  let tab = await getTab(run.tabId);
  if (tab) {
    const loaded = waitForTabLoad(tab.id);
    await chrome.tabs.update(tab.id, { url, active: true });
    await loaded;
  } else {
    tab = await chrome.tabs.create({ url, active: true });
    if (tab.status !== "complete") await waitForTabLoad(tab.id);
  }
  await setAutoRun({ tabId: tab.id });
  // The job list draws itself after the load event.
  await sleep(3000);
  return getTab(tab.id);
}

// Reopening jobs.htm lands on the search view, not the table: press "All
// Jobs", which may take a moment to be drawn after the page loads.
async function waitForJobTable(tabId) {
  const ready = await ensureContentScript(tabId);
  if (!ready.ok) return false;
  for (let waited = 0; waited < TABLE_WAIT_MS; waited += 3000) {
    const shown = await toTab(tabId, "show-all-jobs", undefined, 40000);
    if (shown?.ok) return true;
    await sleep(3000);
  }
  return false;
}

async function anyTabSignedIn() {
  const tabs = await chrome.tabs.query({ url: `${WW_ORIGIN}/*` });
  return tabs.some((t) => isSignedIn(t.url));
}

function signOutInStatus(state) {
  return /signed out|sign in again|not ?logged ?in/i.test(state.statusText || "");
}

// Each step does one thing and says whether to go straight on to the next or
// to wait for the next tick.
const STEPS = {
  async open(run) {
    const tab = await loadInRunTab(run.listUrl);
    if (!isSignedIn(tab?.url)) return goSignIn(run.afterOpen);
    if (!(await waitForJobTable(tab.id))) {
      await finishAutoRun(
        false,
        `The job table didn't appear at ${run.listUrl}, even after pressing "All Jobs". Open it by hand and press Scrape job list once so the daily run learns the page.`
      );
      return "stop";
    }
    await setAutoRun({ phase: run.afterOpen || "list" });
    return "next";
  },

  async list(run) {
    await setAutoRun({ phase: "list-running" });
    await scrapeAllPages(run.tabId);
    return "next";
  },

  async "list-running"() {
    const state = await getState();
    if (state.status === "scraping-list" || state.status === "paused") return "wait";
    if (state.status === "done") {
      await setAutoRun({ phase: "details" });
      return "next";
    }
    if (state.status === "idle") {
      await finishAutoRun(false, "The run was cancelled from the popup.");
      return "stop";
    }
    if (signOutInStatus(state) || !(await anyTabSignedIn())) return goSignIn("list");
    await finishAutoRun(false, `Scraping the job list failed: ${state.statusText}`);
    return "stop";
  },

  async details(run) {
    await setAutoRun({ phase: "details-running" });
    await scrapeDetails(run.tabId);
    return "next";
  },

  async "details-running"() {
    const state = await getState();
    if (state.status === "scraping-details" || state.status === "paused") return "wait";
    if (state.status === "idle") {
      await finishAutoRun(false, "The run was cancelled from the popup.");
      return "stop";
    }
    if (state.status === "error") {
      if (signOutInStatus(state) || !(await anyTabSignedIn())) return goSignIn("details");
      // What was gathered is still worth syncing; the rest waits for tomorrow.
      await setAutoRun({ detailsError: state.statusText });
    }
    await setAutoRun({ phase: "sync" });
    return "next";
  },

  async sync(run) {
    const result = await syncToWebApp();
    if (!result.ok) {
      await finishAutoRun(false, result.error);
      return "stop";
    }
    const after = await fetchSyncedDetailIds();
    const added = Math.max(0, after.ids.size - (run.beforeCount || 0));
    const message =
      `${result.sent} postings listed, ${added} new with details.` +
      (run.detailsError ? ` Some details were missed: ${run.detailsError}` : "");
    await finishAutoRun(true, message);
    return "stop";
  },

  async "sign-in"(run) {
    if (await anyTabSignedIn()) {
      await setAutoRun({ phase: "open", signInStartedAt: null, signInNotified: false });
      return "next";
    }
    const now = Date.now();
    if (!run.signInStartedAt) {
      await setAutoRun({ signInStartedAt: now });
      await loadInRunTab(SSO_LOGIN_URL);
      return (await anyTabSignedIn()) ? STEPS["sign-in"](await getAutoRun()) : "wait";
    }
    if (now - run.signInStartedAt > SIGN_IN_GIVE_UP_MS) {
      await finishAutoRun(false, "Gave up after 12 hours waiting for a WaterlooWorks sign-in.");
      return "stop";
    }
    if (!run.signInNotified && now - run.signInStartedAt > SILENT_SIGN_IN_MS) {
      await setAutoRun({ signInNotified: true });
      await notify(
        "WaterlooWorks needs you to sign in",
        "The UW sign-in has expired. Sign in on the Mac mini (Screen Sharing over Tailscale) and the run carries on by itself.",
        5
      );
    }
    return "wait";
  },
};

async function goSignIn(resumeWith) {
  await setAutoRun({ phase: "sign-in", afterOpen: resumeWith });
  return "next";
}

let advancing = false;

async function advance() {
  if (advancing) return;
  advancing = true;
  try {
    for (;;) {
      const run = await getAutoRun();
      if (!run.phase) {
        await chrome.alarms.clear(TICK_ALARM);
        return;
      }
      // A scrape loop running in this worker reports back through its state;
      // wait for it rather than start another.
      if (runningLoop) return;
      const step = STEPS[run.phase];
      if (!step) {
        await finishAutoRun(false, `The daily run lost track of where it was (${run.phase}).`);
        return;
      }
      const outcome = await step(run);
      if (outcome !== "next") return;
    }
  } catch (err) {
    console.error("[buw] daily run step failed:", err);
    await finishAutoRun(false, `The daily run hit an error: ${err?.message || err}`);
  } finally {
    advancing = false;
  }
}

// === Wiring ===
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM || alarm.name === CATCH_UP_ALARM) startAutoRun("schedule");
  else if (alarm.name === TICK_ALARM) advance();
});

async function onBrowserStart() {
  await scheduleDaily();
  const run = await getAutoRun();
  if (run.phase) {
    chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  } else {
    await catchUpIfOverdue();
  }
}

chrome.runtime.onStartup.addListener(onBrowserStart);
chrome.runtime.onInstalled.addListener(onBrowserStart);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.buwSettings) scheduleDaily();
});
