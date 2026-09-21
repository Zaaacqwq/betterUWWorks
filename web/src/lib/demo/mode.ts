// The demo at /demo: the same pages, the same scoring, sample postings and a
// sample resume in place of the database. Nobody is signed in there, so the
// server would refuse every /api call — the demo answers them itself in the
// browser (server.ts) and keeps what it writes apart from a real student's
// (lib/browser-store.ts).

export const DEMO_PATH = "/demo";

/**
 * Whether this page is the demo. False on the server, where a page is only a
 * shell: everything the demo answers is asked for after it reaches the browser.
 */
export function inDemo(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith(DEMO_PATH);
}
