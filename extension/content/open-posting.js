// Opens the posting named by a "#buw-open=<id>" link from the web app, so its
// Apply button lands on that posting rather than the job search.
//
// WaterlooWorks has no URL for a posting: the list, a posting and its Apply
// all live on jobs.htm, and a posting opens through a POST. What it does have
// is a keyword box that matches a job ID exactly, so search for the id and
// open the one result. Stop at the posting's Apply button — applying means
// choosing documents, which is the student's call, not ours.
(function () {
  "use strict";

  const JOBS_PATH = "/myAccount/co-op/full/jobs.htm";
  const HASH_RE = /^#buw-open=(\d{4,})$/;
  const PENDING_KEY = "buw-open-posting";
  // Long enough to sign in through SSO, short enough that a forgotten request
  // doesn't take over a later visit in the same tab.
  const PENDING_TTL_MS = 10 * 60 * 1000;
  const STEP_TIMEOUT_MS = 20000;

  // A signed-out visit is bounced to notLoggedIn.htm with the hash intact, and
  // sign-in goes through SSO on another origin, which drops it. sessionStorage
  // belongs to this tab and this origin, so the request is still here when
  // SSO sends the student back.
  function readPending() {
    try {
      const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
      if (pending && Date.now() - pending.at < PENDING_TTL_MS) return pending;
    } catch {
      // Unreadable or blocked storage: nothing to resume.
    }
    clearPending();
    return null;
  }

  function savePending(pending) {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      // Storage blocked: this visit can still open the posting, it just can't
      // survive a sign-in.
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  function waitFor(find, timeout = STEP_TIMEOUT_MS) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const found = find();
        if (found) return resolve(found);
        if (Date.now() - start >= timeout) return resolve(null);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  function isShown(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // Same trick as content.js: WaterlooWorks links are href="javascript:void(0)"
  // with the work in a Vue click handler, and letting a content script follow
  // that href trips the extension's CSP. Cancel the dead navigation.
  function activate(el) {
    const suppress = (event) => event.preventDefault();
    el.addEventListener("click", suppress);
    try {
      el.click();
    } finally {
      el.removeEventListener("click", suppress);
    }
  }

  // The landing view's keyword box. It renders a moment after load.
  function findKeywordBox() {
    return [...document.querySelectorAll('input[placeholder*="job ID" i]')].find(isShown) || null;
  }

  function search(box, jobId) {
    box.focus();
    box.value = jobId;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    for (const type of ["keydown", "keyup"]) {
      box.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    }
  }

  // Every result, as a table row or as a card, carries a selection checkbox
  // whose value is the posting id. Its title link is the first link in the
  // nearest ancestor that has one.
  function findResultLink(jobId) {
    let node = document.querySelector(`input[name="dataViewerSelection"][value="${jobId}"]`);
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const link = node.querySelector("a");
      if (link) return link;
    }
    return null;
  }

  // The posting renders into the document viewer (or a modal in older views);
  // wait until it is this posting's, not whatever was open before.
  function findOpenPosting(jobId) {
    const viewers = document.querySelectorAll(
      "article.doc-viewer__document.is--visible, .modal.is--visible:not(#keepMeLoggedInModal)"
    );
    return [...viewers].find((el) => el.textContent.includes(jobId)) || null;
  }

  // The posting's own toolbar, not the copy on the result card beside it.
  function findApplyButton() {
    const buttons = [...document.querySelectorAll('button[aria-label="Apply"]')].filter(isShown);
    return buttons.find((b) => !b.closest(".doc-viewer__card")) || buttons[0] || null;
  }

  function injectStyles() {
    if (document.getElementById("buw-open-posting-style")) return;
    const style = document.createElement("style");
    style.id = "buw-open-posting-style";
    style.textContent = `
      .buw-apply-ready { outline: 3px solid #e8b300; outline-offset: 3px; animation: buw-apply-pulse 1s ease-in-out 5; }
      @keyframes buw-apply-pulse { 50% { outline-color: transparent; } }
      .buw-toast { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; max-width: 360px;
        padding: 12px 16px; border-radius: 10px; background: #1f1f1f; color: #fff;
        font: 14px/1.4 system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.25); }
    `;
    document.head.appendChild(style);
  }

  function toast(message) {
    injectStyles();
    const el = document.createElement("div");
    el.className = "buw-toast";
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }

  function pointAt(button) {
    injectStyles();
    button.scrollIntoView({ block: "center", behavior: "smooth" });
    button.classList.add("buw-apply-ready");
    const clear = () => button.classList.remove("buw-apply-ready");
    button.addEventListener("click", clear, { once: true });
    setTimeout(clear, 10000);
  }

  async function openPosting(jobId) {
    const box = await waitFor(findKeywordBox);
    if (!box) return toast(`betterUWWorks couldn't find WaterlooWorks' search box. Search for job ${jobId} to open it.`);
    search(box, jobId);

    const link = await waitFor(() => findResultLink(jobId));
    if (!link) return toast(`Job ${jobId} isn't in WaterlooWorks' search results — it may have closed.`);
    activate(link);

    if (!(await waitFor(() => findOpenPosting(jobId)))) {
      return toast(`Found job ${jobId}, but its posting didn't open. Click it in the results.`);
    }
    const apply = await waitFor(findApplyButton, 5000);
    if (apply) pointAt(apply);
    // No Apply button means already applied or not open to this student; the
    // posting itself says which.
  }

  const fromHash = location.hash.match(HASH_RE);
  if (fromHash) {
    savePending({ jobId: fromHash[1], at: Date.now(), redirected: false });
    history.replaceState(history.state, "", location.pathname + location.search);
  }

  const pending = readPending();
  // Only the student's own pages mean signed in; notLoggedIn.htm, home.htm
  // and the SSO hops all sit outside /myAccount/.
  if (!pending || !location.pathname.startsWith("/myAccount/")) return;

  if (location.pathname !== JOBS_PATH) {
    // Back from SSO on the dashboard. Head for the jobs page once, so a
    // redirect there that bounces elsewhere can't loop.
    if (pending.redirected) return clearPending();
    savePending({ ...pending, redirected: true });
    location.assign(JOBS_PATH);
    return;
  }

  clearPending();
  openPosting(pending.jobId).catch((e) => console.warn("[buw] opening a posting failed:", e));
})();
