// Whether this browser has been through the tour. Bump TOUR_VERSION when the
// tour gains steps worth showing to people who have already seen it.
export const TOUR_VERSION = 1;
const KEY = "buw-tour-seen";

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === String(TOUR_VERSION);
  } catch {
    // No storage (private mode, blocked): treat as seen rather than open the
    // tour on every visit with no way to remember it was closed.
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(KEY, String(TOUR_VERSION));
  } catch {
    /* nothing to remember it in; tourSeen() already answers "seen" */
  }
}
