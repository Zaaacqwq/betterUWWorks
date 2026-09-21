import { inDemo } from "@/lib/demo/mode";

// What a page keeps in this browser: the resume, the postings saved and turned
// down, cover letter drafts. The demo runs the same components, so it would
// write the same keys — it is given a store of its own instead. A student who
// looks at the demo before signing in still finds their own resume afterwards,
// and the demo starts each visit fresh.
//
// Otherwise this is localStorage itself: it throws where localStorage throws
// (a private window, a browser set to refuse storage), and every caller
// handles that the way it always has.

const DEMO_PREFIX = "buw-demo:";

function backing(): Storage {
  return inDemo() ? sessionStorage : localStorage;
}

function scoped(key: string): string {
  return inDemo() ? DEMO_PREFIX + key : key;
}

export const store = {
  getItem(key: string): string | null {
    return backing().getItem(scoped(key));
  },
  setItem(key: string, value: string): void {
    backing().setItem(scoped(key), value);
  },
  removeItem(key: string): void {
    backing().removeItem(scoped(key));
  },
};
