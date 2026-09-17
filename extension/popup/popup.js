(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const statusBox = $("statusBox");
  const statusDot = $("statusDot");
  const statusText = $("statusText");
  const statJobs = $("statJobs");
  const statDetails = $("statDetails");
  const statErrors = $("statErrors");
  const progressSection = $("progressSection");
  const progressLabel = $("progressLabel");
  const progressPct = $("progressPct");
  const progressFill = $("progressFill");
  const progressEta = $("progressEta");
  const controlRow = $("controlRow");
  const btnScrapeAll = $("btnScrapeAll");
  const btnScrapeDetails = $("btnScrapeDetails");
  const btnPause = $("btnPause");
  const btnCancel = $("btnCancel");
  const btnExport = $("btnExport");
  const btnSync = $("btnSync");
  const btnReset = $("btnReset");
  const step1 = $("step1");
  const step2 = $("step2");
  const step3 = $("step3");

  const btnSettings = $("btnSettings");
  const settingsPanel = $("settingsPanel");
  const inputWebUrl = $("inputWebUrl");
  const inputApiKey = $("inputApiKey");
  const btnSaveSettings = $("btnSaveSettings");
  const savedNote = $("savedNote");
  const btnTestSettings = $("btnTestSettings");
  const testNote = $("testNote");
  const linkWebApp = $("linkWebApp");
  const inputAutoRun = $("inputAutoRun");
  const inputAutoRunTime = $("inputAutoRunTime");
  const inputNtfyTopic = $("inputNtfyTopic");
  const inputScraperAccount = $("inputScraperAccount");
  const autoLine = $("autoLine");
  const autoMsg = $("autoMsg");
  const btnRunNow = $("btnRunNow");

  let startTime = null;
  let lastState = null;
  let syncing = false;
  let resetArmed = false;
  let resetTimer = null;

  // A message from the popup itself ("Synced 304 jobs", "Sync failed: ...").
  // The background state is polled every second, so without this the poll
  // painted over the message before it could be read. It holds until the
  // background reports something new.
  let notice = null;

  function paintStatus(text, kind) {
    statusText.textContent = text;
    statusDot.className = "status-dot" + (kind ? " " + kind : "");
    statusBox.classList.toggle("error", kind === "error");
  }

  function showNotice(text, kind) {
    notice = { text, kind, status: lastState?.status, statusText: lastState?.statusText };
    paintStatus(text, kind);
  }

  function setStep(active, done1, done2) {
    step1.className = "step" + (done1 ? " done" : active === 1 ? " active" : "");
    step2.className = "step" + (done2 ? " done" : active === 2 ? " active" : "");
    step3.className = "step" + (active === 3 ? " active" : "");
  }

  function formatEta(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.ceil(seconds % 60);
    return m > 0 ? `~${m}m ${s}s remaining` : `~${s}s remaining`;
  }

  function renderState(s) {
    if (!s) return;

    lastState = s;
    const dotClass = {
      idle: "", error: "error", done: "success",
      "scraping-list": "active", "scraping-details": "active",
      paused: "paused",
    }[s.status] || "";
    if (notice && (notice.status !== s.status || notice.statusText !== s.statusText)) notice = null;
    if (notice) paintStatus(notice.text, notice.kind);
    else paintStatus(s.statusText || "Ready.", dotClass);

    const jobCount = s.jobs?.length || 0;
    const details = s.jobDetails || {};
    const detailKeys = Object.keys(details);
    // Mirrors the background's rule: a detail with no fields is not a success,
    // however cleanly it was fetched.
    const hasFields = (d) => d && !d._error && Object.keys(d).some((k) => !k.startsWith("_"));
    const localCount = detailKeys.filter((k) => hasFields(details[k])).length;

    // A detail synced to the web app is still a detail. Only the background
    // knows how many of those there are, so prefer its figure — counting the
    // local copy alone showed 73 of 2170 for a run that was missing 7.
    const successCount = typeof s.capturedCount === "number" ? s.capturedCount : localCount;
    const errorCount = detailKeys.filter((k) => details[k]?._error).length;
    statJobs.textContent = jobCount;
    statDetails.textContent = successCount;
    if (jobCount > 0) {
      const of = document.createElement("small");
      of.textContent = `/ ${jobCount}`;
      statDetails.append(of);
    }
    statErrors.textContent = errorCount;
    statErrors.classList.toggle("bad", errorCount > 0);

    // A reclaimed service worker leaves the status saying "scraping" forever.
    // Treat a run whose heartbeat has gone quiet as stalled so the controls
    // come back instead of the popup looking frozen.
    // Must clear the background's own 75s message deadline, or a single slow
    // page turn reads as a dead run.
    const STALL_MS = 150000;
    const stalled =
      (s.status === "scraping-list" || s.status === "scraping-details") &&
      s.lastTickAt > 0 &&
      Date.now() - s.lastTickAt > STALL_MS;

    const isBusy = !stalled && (s.status === "scraping-list" || s.status === "scraping-details" || s.status === "paused");
    if (isBusy && s.progress?.total > 0) {
      progressSection.classList.add("visible");
      // Floor, not round: 2107 of 2113 rounds to 100% and claims a run is
      // finished while six postings still have nothing.
      const ratio = s.progress.current / s.progress.total;
      const pct = ratio >= 1 ? 100 : Math.min(99, Math.floor(ratio * 100));
      progressPct.textContent = pct + "%";
      progressFill.style.width = pct + "%";
      progressFill.className = "progress-fill" + (s.status === "paused" ? " paused" : "");
      progressLabel.textContent = s.progress.label || "";

      if (startTime && s.progress.current > 0 && s.status !== "paused") {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = s.progress.current / elapsed;
        const remaining = (s.progress.total - s.progress.current) / rate;
        progressEta.textContent = formatEta(remaining);
      } else if (s.status === "paused") {
        progressEta.textContent = "Paused";
      } else {
        progressEta.textContent = "";
      }
    } else {
      progressSection.classList.remove("visible");
    }

    if (s.status === "scraping-list") {
      setStep(1, false, false);
      if (!startTime) startTime = Date.now();
    } else if (s.status === "scraping-details" || (s.status === "paused" && detailKeys.length > 0)) {
      setStep(2, true, false);
    } else if (s.status === "done" && successCount > 0) {
      setStep(3, true, true);
    } else if (s.status === "done" && jobCount > 0) {
      setStep(2, true, false);
    } else {
      setStep(0, false, false);
    }

    const scraping = !stalled && (s.status === "scraping-list" || s.status === "scraping-details");
    const paused = s.status === "paused";

    if (stalled && !notice) {
      const mins = Math.round((Date.now() - s.lastTickAt) / 60000);
      paintStatus(
        `Stopped responding ${mins} minute(s) ago — press Scrape details to pick up where it left off.`,
        "error"
      );
    }

    btnScrapeAll.disabled = scraping || paused;
    btnScrapeDetails.disabled = scraping || paused || jobCount === 0;
    btnExport.disabled = jobCount === 0;
    btnSync.disabled = jobCount === 0 || syncing;
    btnReset.disabled = scraping || (jobCount === 0 && detailKeys.length === 0);
    if (btnReset.disabled) disarmReset();

    // Only the step that comes next gets the filled button.
    const next = scraping || paused
      ? null
      : jobCount === 0
        ? btnScrapeAll
        : successCount < jobCount
          ? btnScrapeDetails
          : btnSync;
    for (const b of [btnScrapeAll, btnScrapeDetails, btnSync]) b.classList.toggle("primary", b === next);

    controlRow.classList.toggle("hidden", !scraping && !paused);
    btnPause.textContent = paused ? "Resume" : "Pause";
    btnPause.classList.toggle("primary", paused);
  }

  const bgMsg = (action, extra) =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ source: "buw-popup-cmd", action, ...extra }, (r) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(r);
      });
    });

  bgMsg("get-state").then(renderState);

  const poll = setInterval(() => bgMsg("get-state").then(renderState), 1000);
  window.addEventListener("unload", () => clearInterval(poll));

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.source === "buw-bg" && msg.action === "state-update") renderState(msg.state);
  });

  function getActiveTabId() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) return resolve({ error: "No active tab." });
        if (!tab.url?.includes("waterlooworks.uwaterloo.ca"))
          return resolve({ error: "Navigate to WaterlooWorks first." });
        resolve({ tabId: tab.id });
      });
    });
  }

  btnScrapeAll.addEventListener("click", async () => {
    const { tabId, error } = await getActiveTabId();
    if (error) return showNotice(error, "error");
    notice = null;
    startTime = Date.now();
    bgMsg("start-scrape-list", { tabId });
  });

  btnScrapeDetails.addEventListener("click", async () => {
    const { tabId, error } = await getActiveTabId();
    if (error) return showNotice(error, "error");
    notice = null;
    startTime = Date.now();
    bgMsg("start-scrape-details", { tabId });
  });

  btnPause.addEventListener("click", async () => {
    const s = await bgMsg("get-state");
    if (s?.status === "paused") {
      const { tabId, error } = await getActiveTabId();
      if (error) return showNotice(error, "error");
      bgMsg("resume", { tabId });
    } else {
      bgMsg("pause");
    }
  });

  btnCancel.addEventListener("click", () => bgMsg("cancel"));

  // Reset throws away every scraped job and detail, which can be hours of
  // work, so it takes a second click within a few seconds.
  function disarmReset() {
    if (!resetArmed) return;
    resetArmed = false;
    clearTimeout(resetTimer);
    btnReset.textContent = "Reset";
    btnReset.classList.remove("confirming");
  }

  btnReset.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      const n = lastState?.jobs?.length || 0;
      btnReset.textContent = `Click again to clear ${n} job${n === 1 ? "" : "s"}`;
      btnReset.classList.add("confirming");
      resetTimer = setTimeout(disarmReset, 4000);
      return;
    }
    disarmReset();
    startTime = null;
    notice = null;
    bgMsg("reset").then(() => bgMsg("get-state")).then(renderState);
  });
  btnReset.addEventListener("blur", disarmReset);

  btnExport.addEventListener("click", async () => {
    const data = await bgMsg("export");
    if (!data?.jobs) return;

    const exportData = data.jobs.map((job) => ({
      ...job,
      detail: data.jobDetails[job.jobId] || null,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ww-jobs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Exported ${exportData.length} jobs.`, "success");
  });

  // === Sync to web app ===
  // The worker does the sync (sync.js), so the daily run and this button send
  // exactly the same thing.
  btnSync.addEventListener("click", async () => {
    syncing = true;
    btnSync.disabled = true;
    btnSync.textContent = "Syncing…";
    showNotice(`Syncing ${lastState?.jobs?.length || 0} jobs…`, "active");
    try {
      const result = await bgMsg("sync");
      if (result?.ok) {
        showNotice(`Synced ${result.imported} jobs to the web app.`, "success");
      } else {
        if (result?.needsSettings) {
          openSettings();
          inputWebUrl.focus();
        }
        showNotice(result?.error || "Sync failed: the extension did not answer.", "error");
      }
    } finally {
      syncing = false;
      btnSync.textContent = "Sync to web app";
      if (lastState) renderState(lastState);
    }
  });

  // === Daily run ===
  const PHASE_LABELS = {
    open: "opening the job list",
    "sign-in": "waiting for a WaterlooWorks sign-in",
    list: "scraping the job list",
    "list-running": "scraping the job list",
    details: "scraping new postings",
    "details-running": "scraping new postings",
    sync: "syncing",
  };

  function formatWhen(ts) {
    const d = new Date(ts);
    const sameDay = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return sameDay ? `today ${time}` : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  }

  async function renderAutoRun() {
    const [run, stored] = await Promise.all([bgMsg("autorun-status"), chrome.storage.local.get("buwSettings")]);
    const settings = stored.buwSettings || {};
    const last = run?.lastRun;
    autoLine.classList.remove("bad");
    if (run?.phase) {
      autoLine.textContent = `Running — ${PHASE_LABELS[run.phase] || run.phase}…`;
    } else {
      const schedule = settings.autoRun ? `Every day at ${settings.autoRunTime || "06:00"}` : "Off";
      const onDuty = (settings.scraperAccount || "").trim();
      const dutyText = onDuty ? ` · ${onDuty} on duty` : "";
      const lastText = last ? ` · last ${formatWhen(last.at)} ${last.ok ? "✓" : "failed"}` : "";
      autoLine.textContent = schedule + dutyText + lastText;
      autoLine.classList.toggle("bad", !!last && !last.ok);
    }
    autoMsg.textContent = last?.message || "";
    autoMsg.title = last?.message || "";
    autoMsg.classList.toggle("hidden", !last?.message || !!run?.phase);
    btnRunNow.disabled = !!run?.phase;
  }

  btnRunNow.addEventListener("click", async () => {
    btnRunNow.disabled = true;
    const result = await bgMsg("run-now");
    if (result?.ok) {
      notice = null;
      startTime = Date.now();
    } else {
      showNotice(result?.error || "The daily run did not start.", "error");
    }
    renderAutoRun();
  });

  renderAutoRun();
  const autoPoll = setInterval(renderAutoRun, 2000);
  window.addEventListener("unload", () => clearInterval(autoPoll));

  // === Settings ===
  function openSettings() {
    settingsPanel.classList.remove("hidden");
    btnSettings.setAttribute("aria-expanded", "true");
  }

  btnSettings.addEventListener("click", () => {
    const open = settingsPanel.classList.toggle("hidden") === false;
    btnSettings.setAttribute("aria-expanded", String(open));
  });

  function showWebLink(webUrl) {
    linkWebApp.classList.toggle("hidden", !webUrl);
    if (webUrl) linkWebApp.href = webUrl;
  }

  chrome.storage.local.get("buwSettings", (result) => {
    const s = result.buwSettings || {};
    inputWebUrl.value = s.webUrl || "";
    inputApiKey.value = s.apiKey || "";
    inputAutoRun.checked = !!s.autoRun;
    inputAutoRunTime.value = s.autoRunTime || "06:00";
    inputNtfyTopic.value = s.ntfyTopic || "";
    inputScraperAccount.value = s.scraperAccount || "";
    showWebLink(s.webUrl);
  });

  // The API key field is a password box, so a wrong paste is invisible until
  // a run fails. This asks the web app with exactly what is typed above.
  function showTest(text, kind) {
    testNote.textContent = text;
    testNote.className = "test-note" + (kind ? " " + kind : "");
  }

  btnTestSettings.addEventListener("click", async () => {
    const webUrl = inputWebUrl.value.trim().replace(/\/+$/, "");
    const apiKey = inputApiKey.value.trim();
    if (!webUrl) return showTest("Enter the web app URL first.", "bad");
    if (apiKey.startsWith("sk-")) {
      return showTest("That's an AI provider key (sk-…). This field wants the web app's own API_KEY: 64 letters and digits.", "bad");
    }
    btnTestSettings.disabled = true;
    showTest("Checking…");
    try {
      const resp = await fetch(`${webUrl}/api/jobs/with-detail`, { headers: apiKey ? { "x-api-key": apiKey } : {} });
      if (resp.status === 401 || resp.status === 403) {
        showTest(`The web app refused this API key (${resp.status}). It is ${apiKey.length} characters; the right one is 64.`, "bad");
      } else if (!resp.ok) {
        showTest(`The web app answered ${resp.status}.`, "bad");
      } else {
        const body = await resp.json();
        showTest(`Works — the web app holds ${body?.data?.jobIds?.length ?? 0} postings with details. Press Save to keep it.`, "ok");
      }
    } catch (err) {
      showTest(`Couldn't reach ${webUrl} (${err.message}). Is the URL right?`, "bad");
    } finally {
      btnTestSettings.disabled = false;
    }
  });

  btnSaveSettings.addEventListener("click", () => {
    const webUrl = inputWebUrl.value.trim().replace(/\/+$/, "");
    if (webUrl && !/^https?:\/\/\S+$/.test(webUrl)) {
      showNotice("The web app URL should start with http:// or https://", "error");
      inputWebUrl.focus();
      return;
    }
    const ntfyTopic = inputNtfyTopic.value.trim();
    if (ntfyTopic && !/^[A-Za-z0-9_-]{1,64}$/.test(ntfyTopic)) {
      showNotice("The ntfy topic can only use letters, digits, - and _ (up to 64).", "error");
      inputNtfyTopic.focus();
      return;
    }
    const settings = {
      webUrl,
      apiKey: inputApiKey.value.trim(),
      autoRun: inputAutoRun.checked,
      autoRunTime: inputAutoRunTime.value || "06:00",
      ntfyTopic,
      scraperAccount: inputScraperAccount.value.trim().slice(0, 80),
    };
    chrome.storage.local.set({ buwSettings: settings }, () => {
      showWebLink(webUrl);
      savedNote.classList.remove("hidden");
      renderAutoRun();
      setTimeout(() => savedNote.classList.add("hidden"), 2000);
    });
  });
})();
