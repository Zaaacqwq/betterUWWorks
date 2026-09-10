(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

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

  let startTime = null;

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

    const dotClass = {
      idle: "", error: "error", done: "success",
      "scraping-list": "active", "scraping-details": "active",
      paused: "paused",
    }[s.status] || "";
    statusDot.className = "status-dot" + (dotClass ? " " + dotClass : "");
    statusText.textContent = s.statusText || "Ready.";

    const jobCount = s.jobs?.length || 0;
    const details = s.jobDetails || {};
    const detailKeys = Object.keys(details);
    // Mirrors the background's rule: a detail with no fields is not a success,
    // however cleanly it was fetched.
    const hasFields = (d) => d && !d._error && Object.keys(d).some((k) => !k.startsWith("_"));
    const successCount = detailKeys.filter((k) => hasFields(details[k])).length;
    const errorCount = detailKeys.length - successCount;
    statJobs.textContent = jobCount;
    statDetails.textContent = successCount;
    statErrors.textContent = errorCount;

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

    if (stalled) {
      const mins = Math.round((Date.now() - s.lastTickAt) / 60000);
      statusText.textContent =
        `Stopped responding ${mins} minute(s) ago — press Scrape Details to pick up where it left off.`;
      statusDot.className = "status-dot error";
    }

    btnScrapeAll.disabled = scraping || paused;
    btnScrapeDetails.disabled = scraping || paused || jobCount === 0;
    btnExport.disabled = jobCount === 0;
    btnSync.disabled = jobCount === 0;
    btnReset.disabled = scraping;

    controlRow.classList.toggle("hidden", !scraping && !paused);

    if (paused) {
      btnPause.textContent = "Resume";
      btnPause.className = "btn-success";
    } else {
      btnPause.textContent = "Pause";
      btnPause.className = "btn-warning";
    }
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
    if (error) { statusText.textContent = error; statusDot.className = "status-dot error"; return; }
    startTime = Date.now();
    bgMsg("start-scrape-list", { tabId });
  });

  btnScrapeDetails.addEventListener("click", async () => {
    const { tabId, error } = await getActiveTabId();
    if (error) { statusText.textContent = error; statusDot.className = "status-dot error"; return; }
    startTime = Date.now();
    bgMsg("start-scrape-details", { tabId });
  });

  btnPause.addEventListener("click", async () => {
    const s = await bgMsg("get-state");
    if (s?.status === "paused") {
      const { tabId, error } = await getActiveTabId();
      if (error) { statusText.textContent = error; return; }
      bgMsg("resume", { tabId });
    } else {
      bgMsg("pause");
    }
  });

  btnCancel.addEventListener("click", () => bgMsg("cancel"));

  btnReset.addEventListener("click", () => {
    startTime = null;
    bgMsg("reset").then(() => bgMsg("get-state")).then(renderState);
  });

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
    statusText.textContent = `Exported ${exportData.length} jobs.`;
    statusDot.className = "status-dot success";
  });

  // === Sync to Web ===
  btnSync.addEventListener("click", async () => {
    const settings = await chrome.storage.local.get("buwSettings");
    const webUrl = settings.buwSettings?.webUrl;
    if (!webUrl) {
      statusText.textContent = "Set Web App URL in Settings first.";
      statusDot.className = "status-dot error";
      return;
    }

    const data = await bgMsg("export");
    if (!data?.jobs || data.jobs.length === 0) return;

    const payload = {
      jobs: data.jobs.map((job) => ({
        ...job,
        detail: data.jobDetails[job.jobId] || null,
      })),
      batchId: new Date().toISOString(),
    };

    btnSync.disabled = true;
    btnSync.textContent = "Syncing...";
    statusText.textContent = `Syncing ${payload.jobs.length} jobs...`;
    statusDot.className = "status-dot active";

    try {
      const headers = { "Content-Type": "application/json" };
      const apiKey = settings.buwSettings?.apiKey;
      if (apiKey) headers["x-api-key"] = apiKey;

      const resp = await fetch(`${webUrl}/api/jobs/import`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const result = await resp.json();

      if (resp.ok && result.success) {
        statusText.textContent = `Synced ${result.data.imported} jobs to web app.`;
        statusDot.className = "status-dot success";
      } else {
        const detail = Array.isArray(result.details)
          ? result.details
              .slice(0, 3)
              .map((d) => `${(d.path || []).join(".")}: ${d.message}`)
              .join("; ")
          : "";
        statusText.textContent = `Sync failed: ${result.error || resp.statusText}${
          detail ? ` — ${detail}` : ""
        }`;
        statusDot.className = "status-dot error";
        console.error("[buw] sync failed", result);
      }
    } catch (err) {
      statusText.textContent = `Sync error: ${err.message}`;
      statusDot.className = "status-dot error";
    } finally {
      btnSync.disabled = false;
      btnSync.textContent = "Sync to Web";
    }
  });

  // === Settings ===
  btnSettings.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });

  chrome.storage.local.get("buwSettings", (result) => {
    const s = result.buwSettings || {};
    inputWebUrl.value = s.webUrl || "";
    inputApiKey.value = s.apiKey || "";
  });

  btnSaveSettings.addEventListener("click", () => {
    const settings = {
      webUrl: inputWebUrl.value.trim().replace(/\/+$/, ""),
      apiKey: inputApiKey.value.trim(),
    };
    chrome.storage.local.set({ buwSettings: settings }, () => {
      statusText.textContent = "Settings saved.";
      statusDot.className = "status-dot success";
    });
  });
})();
