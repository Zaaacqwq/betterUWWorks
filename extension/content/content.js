(function () {
  "use strict";

  const TABLE_SEL = "table.data-viewer-table";
  const ROW_SEL = "tbody tr";
  const CELL_SEL = "td.table__value";
  // A posting no longer opens in a .modal — it renders into the document
  // viewer's article, which is always present and marked is--visible while a
  // posting is open. The old selector matched nothing, so every detail scrape
  // returned "No job detail modal found". The modal form is kept as a fallback
  // for any view still using it.
  const JOB_MODAL_SEL =
    "article.doc-viewer__document.is--visible, .modal.is--visible:not(#keepMeLoggedInModal)";

  console.log("[buw] Content script loaded on", window.location.href);

  // WaterlooWorks ends a session after a fixed idle period, warning first with
  // its "Keep Me Logged In" dialog. A detail run takes long enough to reach it,
  // and nobody is watching to click it, so the site logged out around 700
  // postings in and the rest of the run had nothing to read. Answer the dialog
  // ourselves; it is the one modal the job viewer selector deliberately skips.
  // offsetParent is null for any position: fixed element, which a modal always
  // is, so it cannot be used to decide whether this dialog is showing.
  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  const KEEP_ALIVE_TEXT = /keep\s+me\s+(logged|signed)\s+in/i;
  let lastKeepAlive = 0;

  function keepSessionAlive() {
    // Search the whole document rather than one id: the button is what matters,
    // and it is distinctive enough to find on its own.
    const button = Array.from(document.querySelectorAll("button, a, input[type=button], input[type=submit]")).find(
      (el) => KEEP_ALIVE_TEXT.test(el.textContent || el.value || "") && isVisible(el)
    );
    if (!button) return false;

    // The dialog can linger a moment after answering; don't hammer it.
    const now = Date.now();
    if (now - lastKeepAlive < 30000) return false;
    lastKeepAlive = now;

    activate(button);
    console.log("[buw] dismissed the session timeout prompt");
    return true;
  }

  function isLoggedOut() {
    return /notLoggedIn|\/login/i.test(location.href);
  }

  setInterval(keepSessionAlive, 5000);

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

  // WaterlooWorks wires its controls as <a href="javascript:..."> with the real
  // work in a click handler. Chrome checks such a URL against the *extension's*
  // CSP when a content script triggers it and blocks it, logging a violation on
  // the extension even though the handler already did the job. Suppress the
  // navigation we know is dead so the handler runs without the noise.
  function activate(el) {
    const href = el.getAttribute("href") || "";
    if (!href.toLowerCase().startsWith("javascript:")) {
      el.click();
      return;
    }
    const suppress = (event) => event.preventDefault();
    el.addEventListener("click", suppress);
    try {
      el.click();
    } finally {
      el.removeEventListener("click", suppress);
    }
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

  // Columns are matched by heading rather than position: WaterlooWorks dropped
  // the id column between terms, and fixed indexes silently shifted every field
  // by one, storing job titles as ids and company names as titles.
  const COLUMN_ALIASES = {
    title: ["job title", "title"],
    organization: ["organization", "company", "employer"],
    division: ["division"],
    openings: ["openings", "number of openings"],
    location: ["location", "job location", "city"],
    level: ["level", "student level", "work term level"],
    deadline: ["deadline", "application deadline", "app deadline"],
  };

  function normalizeHeading(text) {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  // Header and body cell lists have to be gathered the same way, or a column
  // index taken from one does not address the other.
  function rowCells(row) {
    return Array.from(row.querySelectorAll("th, td"));
  }

  function buildColumnMap(table) {
    const headerRow = table.querySelector("thead tr:last-of-type");
    const headings = (headerRow ? rowCells(headerRow) : [])
      .map((cell) => normalizeHeading(cell.textContent || ""));

    const map = {};
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      let index = headings.findIndex((h) => aliases.includes(h));
      if (index === -1) index = headings.findIndex((h) => h && aliases.some((a) => h.includes(a)));
      if (index !== -1) map[field] = index;
    }
    return { map, headings };
  }

  // The id is no longer a column. Every row carries the data viewer's own
  // selection checkbox, whose value is the posting id — the one place it still
  // appears verbatim now that the links are all javascript:void(0).
  function rowJobId(row) {
    const selection = row.querySelector('input[name="dataViewerSelection"]');
    if (selection?.value) return selection.value.trim();

    const href = row.querySelector("a[href]")?.getAttribute("href") || "";
    const fromHref = href.match(/ck_jobid=(\d+)/);
    if (fromHref) return fromHref[1];

    const onclick = row.getAttribute("onclick") || row.querySelector("[onclick]")?.getAttribute("onclick") || "";
    const fromOnclick = onclick.match(/(\d{5,})/);
    if (fromOnclick) return fromOnclick[1];

    const rowId = row.getAttribute("id") || row.getAttribute("data-id") || "";
    const fromRowId = rowId.match(/(\d{5,})/);
    return fromRowId ? fromRowId[1] : null;
  }

  function scrapeCurrentPage() {
    const table = document.querySelector(TABLE_SEL);
    if (!table) return { error: true, message: "Job table not found." };

    const { map, headings } = buildColumnMap(table);
    for (const field of ["title", "organization"]) {
      if (map[field] === undefined) {
        return {
          error: true,
          message: `No "${field}" column. Headings seen: ${headings.filter(Boolean).join(" | ")}`,
        };
      }
    }

    const rows = table.querySelectorAll(ROW_SEL);
    const jobs = [];
    let missingIds = 0;

    for (const row of rows) {
      // Every cell, not just td.table__value: the headings a column index comes
      // from include the leading selection-checkbox column, so reading only the
      // value cells shifted every field one column to the right.
      const cells = rowCells(row);
      if (cells.length < 2) continue;

      if (cells.length !== headings.length) {
        return {
          error: true,
          message:
            `Row has ${cells.length} cells but the header has ${headings.length}. ` +
            `Headings: ${headings.join(" | ")}`,
        };
      }

      const jobId = rowJobId(row);
      if (!jobId) { missingIds++; continue; }

      const t = cells.map((c) => c.textContent.trim());
      const at = (field) => (map[field] === undefined ? "" : t[map[field]] || "");

      jobs.push({
        jobId,
        title: at("title"),
        organization: at("organization"),
        division: at("division"),
        openings: parseInt(at("openings"), 10) || 0,
        location: at("location"),
        level: at("level"),
        deadline: at("deadline"),
      });
    }

    return { error: false, jobs, missingIds, pageNumber: currentPageNumber() };
  }

  // The page the list is actually showing. A counter in the background cannot
  // know this: signing back in drops the list to page one under it.
  function currentPageNumber() {
    const active = document.querySelector(
      ".pagination__item.is--active .pagination__link, .pagination__item .pagination__link.active, .pagination__item.active .pagination__link"
    );
    const n = parseInt((active?.textContent || "").trim(), 10);
    return Number.isInteger(n) ? n : null;
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

  const OVERVIEW_MARKER = "JOB POSTING INFORMATION";

  function findTab(modal, label) {
    return Array.from(modal.querySelectorAll("a.items")).find((t) =>
      t.textContent.trim().toUpperCase().includes(label)
    );
  }

  function showOverviewTab() {
    const modal = document.querySelector(JOB_MODAL_SEL);
    const tab = modal && findTab(modal, "OVERVIEW");
    if (tab) activate(tab);
    return !!tab;
  }

  function panelText(modal) {
    return Array.from(modal.querySelectorAll("[id^='panel_']"))
      .map((p) => p.innerText)
      .join("\n");
  }

  // Resolves once the open posting is the one asked for *and* its fields have
  // arrived. The viewer paints its header, id included, before the panels are
  // filled in, so resolving on the id alone captured documents with no fields
  // in them — 15 postings came back holding nothing but their ratings chart.
  function waitForJobDetail(jobId, timeout = 20000, settleMs = 300) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      let lastLen = -1;
      let stableSince = 0;

      const tick = () => {
        const modal = document.querySelector(JOB_MODAL_SEL);
        const text = modal ? panelText(modal) : "";

        if (text.length !== lastLen) {
          lastLen = text.length;
          stableSince = Date.now();
        }

        const isThisJob = modal && (!jobId || modal.innerText.includes(jobId));
        const loaded = text.includes(OVERVIEW_MARKER);
        if (isThisJob && loaded && Date.now() - stableSince >= settleMs) return resolve(modal);

        if (Date.now() - start >= timeout) {
          const why = !modal
            ? "viewer never opened"
            : !isThisJob
              ? "viewer stayed on another posting"
              : "fields never loaded";
          reject(new Error(`Posting ${jobId}: ${why}`));
          return;
        }
        setTimeout(tick, 100);
      };

      tick();
    });
  }

  function scrapeJobDetail() {
    const modal = document.querySelector(JOB_MODAL_SEL);
    if (!modal) return { error: true, message: "No job detail modal found." };

    // Only the flat keys are kept. _sections repeated every key and value a
    // second time under its heading, and its _content is read by nothing —
    // dead weight that doubled what the run had to hold in extension storage.
    const detail = {};
    const panels = modal.querySelectorAll("[id^='panel_']");

    for (const panel of panels) {
      const lines = panel.innerText.trim().split("\n").map((l) => l.trim());
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }

        if (SECTION_HEADINGS.has(line.toUpperCase())) {
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
          if (key) detail[key] = value;
        } else {
          i++;
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

    // Every message is a chance to answer the timeout dialog, which otherwise
    // sits over the page blocking the clicks the scrape depends on.
    keepSessionAlive();

    if (isLoggedOut() && msg.action !== "ping") {
      sendResponse({ error: true, loggedOut: true, message: "Signed out of WaterlooWorks — sign in again, then press Scrape Details" });
      return false;
    }

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
          activate(link);
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
          activate(nextLink);
          waitForTableChange(oldId).then(() => sendResponse({ ok: true }))
            .catch(() => sendResponse({ ok: false, message: "Table didn't change" }));
        } else {
          sendResponse({ ok: false, message: "No next page" });
        }
        return true;
      }

      case "click-job": {
        const rows = document.querySelectorAll(`${TABLE_SEL} ${ROW_SEL}`);
        // Distinguish a missing list from a row that is genuinely elsewhere:
        // "not on current page" for all of them reads like a paging bug when
        // the real cause is that the results are not in table form at all.
        if (rows.length === 0) {
          sendResponse({
            error: true,
            message: document.querySelector(TABLE_SEL)
              ? "Job table has no rows"
              : "No job table on this page — switch the results to table view",
          });
          return false;
        }
        for (const row of rows) {
          if (rowJobId(row) === msg.payload.jobId) {
            const link = row.querySelector("a");
            activate(link || row);
            sendResponse({ ok: true });
            return false;
          }
        }
        sendResponse({ error: true, message: `Job ${msg.payload.jobId} not on current page` });
        return false;
      }

      case "scrape-detail": {
        // The document viewer stays open between postings, so the container
        // being present says nothing about which posting it holds. Wait until
        // it shows the id we asked for, or the previous posting's detail gets
        // recorded against this one.
        // The previous posting left the viewer on its ratings tab if that
        // scrape ran, so put it back on the overview before reading fields.
        showOverviewTab();
        waitForJobDetail(msg.payload?.jobId)
          .then(() => sendResponse(scrapeJobDetail()))
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
            activate(tab);
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
        sendResponse({ ok: showOverviewTab() });
        return false;
      }

      case "close-modal": {
        const modal = document.querySelector(JOB_MODAL_SEL);
        if (modal) {
          const btn = modal.querySelector("[class*='close'], .material-icons");
          if (btn) activate(btn);
        }
        sendResponse({ ok: true });
        return false;
      }

      default:
        return false;
    }
  });
})();
