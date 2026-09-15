import { afterEach, describe, expect, it, vi } from "vitest";
import { TOUR_STEPS, needsDetail, selectSteps } from "./steps";
import { TOUR_VERSION, markTourSeen, tourSeen } from "./storage";

const ids = (ctx: Parameters<typeof selectSteps>[0]) => selectSteps(ctx).map((s) => s.id);

describe("selectSteps", () => {
  it("opens with the welcome and the resume prompt for a new visitor", () => {
    expect(ids({ segment: "intro", hasResume: false, desktop: true })).toEqual(["welcome", "resume"]);
  });

  it("opens with just the welcome once a resume is on file", () => {
    expect(ids({ segment: "intro", hasResume: true, desktop: true })).toEqual(["welcome"]);
  });

  it("numbers the full tour, match steps included, when there is a resume", () => {
    const steps = ids({ segment: "main", hasResume: true, desktop: true });
    expect(steps).toEqual([
      "search", "filters", "sort", "card", "match", "facts", "glance", "skills", "save", "copy-id", "match-tab", "advice", "cover", "done",
    ]);
  });

  it("leaves out the match steps after a skipped upload, so nothing stalls and the count is true", () => {
    const steps = ids({ segment: "main", hasResume: false, desktop: true });
    expect(steps).not.toContain("match");
    expect(steps).not.toContain("match-tab");
    expect(steps).not.toContain("skills");
    expect(steps).not.toContain("advice");
    expect(steps).toHaveLength(9);
  });

  it("says nothing about a match score it can't show", () => {
    const steps = selectSteps({ segment: "main", hasResume: false, desktop: true });
    for (const s of steps.filter((s) => s.id !== "done")) expect(s.body).not.toMatch(/your match|best matches first|ticked/i);
    expect(steps.at(-1)?.body).toMatch(/Once your resume is in/);
  });

  it("keeps small screens to the list, where the detail pane isn't beside it", () => {
    const steps = selectSteps({ segment: "main", hasResume: true, desktop: false });
    expect(steps.map((s) => s.id)).toEqual(["search", "filters", "sort", "card", "match", "done"]);
    expect(needsDetail(steps)).toBe(false);
  });

  it("points every step with an element at a data-tour hook", () => {
    for (const step of TOUR_STEPS.filter((s) => s.element)) {
      expect(step.element).toMatch(/\[data-tour="[a-z-]+"\]/);
    }
  });
});

describe("tour storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers that the tour was seen", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    expect(tourSeen()).toBe(false);
    markTourSeen();
    expect(tourSeen()).toBe(true);
    expect(store.get("buw-tour-seen")).toBe(String(TOUR_VERSION));
  });

  it("shows the tour again when its version moves on", () => {
    vi.stubGlobal("localStorage", { getItem: () => String(TOUR_VERSION - 1), setItem: () => {} });
    expect(tourSeen()).toBe(false);
  });

  it("treats blocked storage as seen instead of throwing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(tourSeen()).toBe(true);
    expect(() => markTourSeen()).not.toThrow();
  });
});
