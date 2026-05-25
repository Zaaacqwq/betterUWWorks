// This script runs in the MAIN world (page context)
// It has access to WaterlooWorks' window functions like getPostingData()

(function () {
  "use strict";

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "buw-content") return;

    const { action, payload } = event.data;

    if (action === "scrape-table") {
      try {
        const result = await scrapeJobTable();
        window.postMessage({
          source: "buw-scraper",
          action: "scrape-table-result",
          payload: result,
        });
      } catch (err) {
        window.postMessage({
          source: "buw-scraper",
          action: "scrape-error",
          payload: { error: err.message },
        });
      }
    }

    if (action === "scrape-job-detail") {
      try {
        const result = await scrapeJobDetail(payload.jobId);
        window.postMessage({
          source: "buw-scraper",
          action: "scrape-job-detail-result",
          payload: result,
        });
      } catch (err) {
        window.postMessage({
          source: "buw-scraper",
          action: "scrape-error",
          payload: { error: err.message, jobId: payload.jobId },
        });
      }
    }
  });

  async function scrapeJobTable() {
    const table = document.querySelector("#postingsTable");
    if (!table) {
      throw new Error(
        "Job table (#postingsTable) not found. Are you on the job listings page?"
      );
    }

    const rows = table.querySelectorAll("tbody tr");
    const jobs = [];

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length === 0) continue;

      const jobLink = row.querySelector("a[href]");
      let jobId = null;

      if (jobLink) {
        const href = jobLink.getAttribute("href") || "";
        const match = href.match(/ck_jobid=(\d+)/);
        if (match) jobId = match[1];
      }

      if (!jobId) {
        const onclick = row.getAttribute("onclick") || "";
        const match = onclick.match(/(\d{6,})/);
        if (match) jobId = match[1];
      }

      if (!jobId) {
        const rowId = row.getAttribute("id") || row.getAttribute("data-id") || "";
        const match = rowId.match(/(\d+)/);
        if (match) jobId = match[1];
      }

      const cellTexts = Array.from(cells).map((c) => c.textContent.trim());

      jobs.push({
        jobId,
        cellTexts,
        rawHtml: row.innerHTML,
      });
    }

    const paginationEl = document.querySelector(
      "div.pagination ul li:nth-last-child(2)"
    );
    const totalPages = paginationEl
      ? parseInt(paginationEl.textContent.trim(), 10) || 1
      : 1;

    return {
      jobs,
      totalPages,
      currentJobCount: jobs.length,
    };
  }

  async function scrapeJobDetail(jobId) {
    const result = { jobId };

    if (typeof window.getPostingData === "function") {
      try {
        const postingData = await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("getPostingData timeout")),
            10000
          );
          window.getPostingData(jobId, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
        result.postingData = postingData;
      } catch (e) {
        result.postingDataError = e.message;
      }
    }

    if (typeof window.getPostingOverview === "function") {
      try {
        const overview = await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("getPostingOverview timeout")),
            10000
          );
          window.getPostingOverview(jobId, (data) => {
            clearTimeout(timeout);
            resolve(data);
          });
        });
        result.overview = overview;
      } catch (e) {
        result.overviewError = e.message;
      }
    }

    return result;
  }

  window.postMessage({
    source: "buw-scraper",
    action: "scraper-ready",
  });
})();
