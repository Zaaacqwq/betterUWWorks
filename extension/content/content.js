(function () {
  "use strict";

  const TABLE_SEL = "table.data-viewer-table";
  const ROW_SEL = "tbody tr";
  const CELL_SEL = "td.table__value";
  const JOB_MODAL_SEL = ".modal.is--visible:not(#keepMeLoggedInModal)";

  console.log("[buw] Content script loaded on", window.location.href);

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error("Timeout: " + selector)); }, timeout);
    });
  }

  // Signature of every job id currently rendered, so we can tell a half-swapped
  // table from a finished one.
  function tableSignature() {
    const rows = document.querySelectorAll(`${TABLE_SEL} ${ROW_SEL}`);
    return Array.from(rows)
      .map((row) => row.querySelector(CELL_SEL)?.textContent?.trim() || "")
      .join(",");
  }

  // WaterlooWorks re-renders the table in several passes: the first row updates
  // before the rest of the body has been replaced. Resolving as soon as the
  // first cell changed let a scrape read a half-updated table, which yielded
  // rows duplicated from the previous page and silently dropped the postings
  // that had not rendered yet. So require both that the page advanced and that
  // the full row set stopped changing for `settleMs`.
  function waitForTableChange(oldFirstId, timeout = 20000, settleMs = 500) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let lastSig = null;
      let stableSince = 0;

      const tick = () => {
        const sig = tableSignature();
        const firstId = sig.split(",")[0] || "";

        if (sig !== lastSig) {
          lastSig = sig;
          stableSince = Date.now();
        }

        const advanced = firstId !== "" && firstId !== oldFirstId;
        if (advanced && Date.now() - stableSince >= settleMs) return resolve();

        if (Date.now() - start >= timeout) {
          return reject(new Error("Table did not settle on a new page"));
        }
        setTimeout(tick, 150);
      };

      tick();
    });
  }

  function scrapeCurrentPage() {
    const table = document.querySelector(TABLE_SEL);
    if (!table) return { error: true, message: "Job table not found." };
    const rows = table.querySelectorAll(ROW_SEL);
    const jobs = [];
    for (const row of rows) {
      const cells = row.querySelectorAll(CELL_SEL);
      if (cells.length < 2) continue;
      const t = Array.from(cells).map((c) => c.textContent.trim());
      jobs.push({
        jobId: t[0] || null, title: t[1] || "", organization: t[2] || "",
        division: t[3] || "", openings: parseInt(t[4], 10) || 0,
        location: t[5] || "", level: t[6] || "", deadline: t[7] || "",
      });
    }
    return { error: false, jobs };
  }

  function getFirstId() {
    const cell = document.querySelector(`${TABLE_SEL} ${ROW_SEL} ${CELL_SEL}`);
    return cell?.textContent?.trim() || "";
  }

  function getTotalResults() {
    const m = document.body.innerText.match(/(\d+)\s*results?/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  const SECTION_HEADINGS = new Set([
    "JOB POSTING INFORMATION", "COMPANY INFORMATION", "APPLICATION INFORMATION",
    "JOB SUMMARY", "JOB RESPONSIBILITIES", "REQUIRED SKILLS",
    "COMPENSATION AND BENEFITS", "TARGETED DEGREES AND DISCIPLINES", "SPECIAL JOB REQUIREMENTS",
  ]);

  function scrapeJobDetail() {
    const modal = document.querySelector(JOB_MODAL_SEL);
    if (!modal) return { error: true, message: "No job detail modal found." };

    const detail = {};
    const panels = modal.querySelectorAll("[id^='panel_']");
    let currentSection = "general";
    detail._sections = {};

    for (const panel of panels) {
      const lines = panel.innerText.trim().split("\n").map((l) => l.trim());
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }

        if (SECTION_HEADINGS.has(line.toUpperCase())) {
          currentSection = line;
          if (!detail._sections[currentSection]) detail._sections[currentSection] = {};
          i++; continue;
        }

        if (line.endsWith(":")) {
          const key = line.slice(0, -1).trim();
          const valLines = [];
          i++;
          while (i < lines.length) {
            const nl = lines[i];
            if (!nl) { i++; continue; }
            if (SECTION_HEADINGS.has(nl.toUpperCase())) break;
            if (nl.endsWith(":") && nl.length < 80) break;
            valLines.push(nl); i++;
          }
          const value = valLines.join("\n").trim();
          if (key) {
            detail[key] = value;
            if (typeof detail._sections[currentSection] === "object")
              detail._sections[currentSection][key] = value;
          }
        } else {
          const contentLines = [line]; i++;
          while (i < lines.length) {
            const nl = lines[i];
            if (!nl) { i++; continue; }
            if (SECTION_HEADINGS.has(nl.toUpperCase())) break;
            if (nl.endsWith(":") && nl.length < 80) break;
            contentLines.push(nl); i++;
          }
          const content = contentLines.join("\n").trim();
          if (content && typeof detail._sections[currentSection] === "object") {
            detail._sections[currentSection]._content =
              (detail._sections[currentSection]._content || "") + "\n" + content;
          }
        }
      }
    }
    return { error: false, detail };
  }

  function scrapeWorkTermRatings() {
    const modal = document.querySelector(JOB_MODAL_SEL);
    if (!modal) return null;

    const result = {
      hiringHistory: null,
      ratingsSummary: null,
      hiresByFaculty: null,
      hiresByWorkTermNumber: null,
      mostHiredPrograms: null,
      charts: [],
    };

    // Parse all tables with headers
    const tables = modal.querySelectorAll("table");
    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll("thead th, thead td"))
        .map((th) => th.textContent.trim());
      if (headers.length < 3) continue;

      const rows = [];
      for (const tr of table.querySelectorAll("tbody tr")) {
        const cells = Array.from(tr.querySelectorAll("td")).map((c) => c.textContent.trim());
        if (cells.length >= 2) rows.push(cells);
      }

      const headerStr = headers.join(" ").toLowerCase();
      if (headerStr.includes("students hired")) {
        result.hiringHistory = { headers, rows };
      } else if (headerStr.includes("work term rating") || headerStr.includes("satisfaction")) {
        result.ratingsSummary = { headers, rows };
      }
    }

    // Parse SVG text elements from Highcharts
    const svgTexts = Array.from(modal.querySelectorAll("svg text"))
      .map((t) => t.textContent.trim())
      .filter(Boolean);

    let currentChart = null;
    const chartData = [];
    for (const text of svgTexts) {
      if (text.startsWith("Hires by Faculty")) {
        currentChart = { title: "Hires by Faculty", data: [] };
        chartData.push(currentChart);
      } else if (text.startsWith("Hires by Student Work Term Number")) {
        currentChart = { title: "Hires by Student Work Term Number", data: [] };
        chartData.push(currentChart);
      } else if (text.startsWith("Most Frequently Hired Programs")) {
        currentChart = { title: "Most Frequently Hired Programs", data: [] };
        chartData.push(currentChart);
      } else if (text.startsWith("Overall Work Term Satisfaction")) {
        currentChart = { title: "Overall Work Term Satisfaction", data: [] };
        chartData.push(currentChart);
      } else if (text.startsWith("Average Rating by Question")) {
        currentChart = { title: "Average Rating by Question", data: [] };
        chartData.push(currentChart);
      } else if (currentChart && text !== "Hires") {
        currentChart.data.push(text);
      }
    }

    // Extract structured data from charts
    for (const chart of chartData) {
      if (chart.title === "Hires by Faculty") {
        result.hiresByFaculty = {};
        for (const d of chart.data) {
          const m = d.match(/^(.+?):\s*([\d.]+)%$/);
          if (m) result.hiresByFaculty[m[1].trim()] = parseFloat(m[2]);
        }
      } else if (chart.title === "Hires by Student Work Term Number") {
        result.hiresByWorkTermNumber = {};
        for (const d of chart.data) {
          const m = d.match(/^(.+?):\s*([\d.]+)%$/);
          if (m) result.hiresByWorkTermNumber[m[1].trim()] = parseFloat(m[2]);
        }
      } else if (chart.title === "Most Frequently Hired Programs") {
        result.mostHiredPrograms = [];
        const nums = [];
        const names = [];
        for (const d of chart.data) {
          if (/^\d+$/.test(d)) nums.push(parseInt(d, 10));
          else if (!/^\d/.test(d) && d.length > 1) names.push(d);
        }
        for (let i = 0; i < names.length && i < nums.length; i++) {
          result.mostHiredPrograms.push({ program: names[i], hires: nums[i] });
        }
      }
    }

    result.charts = chartData;

    return result;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.source !== "buw-bg") return false;

    switch (msg.action) {
      case "ping":
        sendResponse({ ok: true, url: window.location.href, hasTable: !!document.querySelector(TABLE_SEL) });
        return false;

      case "scrape-page":
        waitForElement(TABLE_SEL).then(() => {
          const result = scrapeCurrentPage();
          sendResponse({ ...result, totalResults: getTotalResults() });
        }).catch((e) => sendResponse({ error: true, message: e.message }));
        return true;

      case "get-first-id":
        sendResponse({ id: getFirstId() });
        return false;

      case "is-last-page": {
        const items = document.querySelectorAll(".pagination__item");
        const nextItem = items.length >= 2 ? items[items.length - 2] : null;
        const disabled = !nextItem || nextItem.querySelector(".pagination__link")?.classList.contains("disabled");
        sendResponse({ isLast: disabled });
        return false;
      }

      case "click-first": {
        const items = document.querySelectorAll(".pagination__item");
        const link = items[0]?.querySelector(".pagination__link");
        if (link && !link.classList.contains("disabled")) {
          const oldId = getFirstId();
          link.click();
          waitForTableChange(oldId).then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: true }));
        } else {
          sendResponse({ ok: true });
        }
        return true;
      }

      case "click-next": {
        const items = document.querySelectorAll(".pagination__item");
        const nextLink = items.length >= 2 ? items[items.length - 2]?.querySelector(".pagination__link") : null;
        if (nextLink && !nextLink.classList.contains("disabled")) {
          const oldId = getFirstId();
          nextLink.click();
          waitForTableChange(oldId).then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false, message: "Table didn't change" }));
        } else {
          sendResponse({ ok: false, message: "No next page" });
        }
        return true;
      }

      case "click-job": {
        const rows = document.querySelectorAll(`${TABLE_SEL} ${ROW_SEL}`);
        for (const row of rows) {
          const idCell = row.querySelector(CELL_SEL);
          if (idCell && idCell.textContent.trim() === msg.payload.jobId) {
            const link = row.querySelector("a");
            (link || row).click();
            sendResponse({ ok: true });
            return false;
          }
        }
        sendResponse({ error: true, message: `Job ${msg.payload.jobId} not on current page` });
        return false;
      }

      case "scrape-detail": {
        const modal = document.querySelector(JOB_MODAL_SEL);
        if (modal) { sendResponse(scrapeJobDetail()); return false; }
        waitForElement(JOB_MODAL_SEL).then(() => sleep(600)).then(() => sendResponse(scrapeJobDetail()))
          .catch((e) => sendResponse({ error: true, message: e.message }));
        return true;
      }

      case "click-ratings-tab": {
        const modal = document.querySelector(JOB_MODAL_SEL);
        if (!modal) { sendResponse({ ok: false, message: "No modal" }); return false; }
        const tabLinks = modal.querySelectorAll("a.items");
        let clicked = false;
        for (const tab of tabLinks) {
          if (tab.textContent.trim().toUpperCase().includes("WORK TERM RATING")) {
            tab.click();
            clicked = true;
            break;
          }
        }
        sendResponse({ ok: clicked });
        return false;
      }

      case "scrape-ratings": {
        const data = scrapeWorkTermRatings();
        sendResponse({ ok: true, ratings: data });
        return false;
      }

      case "click-overview-tab": {
        const modal = document.querySelector(JOB_MODAL_SEL);
        if (!modal) { sendResponse({ ok: false }); return false; }
        const tabLinks = modal.querySelectorAll("a.items");
        for (const tab of tabLinks) {
          if (tab.textContent.trim().toUpperCase().includes("OVERVIEW")) {
            tab.click();
            sendResponse({ ok: true });
            return false;
          }
        }
        sendResponse({ ok: false });
        return false;
      }

      case "close-modal": {
        const modal = document.querySelector(JOB_MODAL_SEL);
        if (modal) {
          const btn = modal.querySelector("[class*='close'], .material-icons");
          if (btn) btn.click();
        }
        sendResponse({ ok: true });
        return false;
      }

      default:
        return false;
    }
  });
})();
