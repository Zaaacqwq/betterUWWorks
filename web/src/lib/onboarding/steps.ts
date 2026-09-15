// The first-visit tour, step by step. Each step points at an element marked
// data-tour="…" rather than at styling, so restyling the page cannot break it.

export type TourSide = "top" | "right" | "bottom" | "left";

export interface TourStepSpec {
  id: string;
  /** CSS selector; none for a step shown in the middle of the screen. */
  element?: string;
  title: string;
  body: string;
  side?: TourSide;
  /** Part of the opening (welcome, resume) shown before the numbered tour. */
  intro?: boolean;
  /** Only worth showing before a resume is on file. */
  untilResume?: boolean;
  /** About the match score, which only exists once a resume is on file. */
  needsResume?: boolean;
  /** Said instead of `body` when there is no resume. */
  bodyWithoutResume?: string;
  /** Needs the side-by-side detail pane, which small screens don't have. */
  desktopOnly?: boolean;
  /** Lives in the detail pane; the tour opens the first posting for it. */
  inDetail?: boolean;
  /** May not be on the page (no match score yet); skipped when absent. */
  optional?: boolean;
  /** How long to wait for the element to appear before skipping it. */
  waitMs?: number;
  /** Clicked on leaving the step with Next, e.g. to open the tab it points at. */
  clickOnNext?: string;
}

export const TOUR_STEPS: TourStepSpec[] = [
  {
    id: "welcome",
    intro: true,
    title: "Welcome to betterUWWorks",
    body: "Every WaterlooWorks co-op posting in one fast list, scored against your resume. Here's how it works — it takes about a minute.",
  },
  {
    id: "resume",
    element: '[data-tour="resume"]',
    title: "Start with your resume",
    body: "Upload it once and every posting gets a match score for your skills. AI reads it; after that it stays in this browser only.",
    side: "bottom",
    intro: true,
    untilResume: true,
  },
  {
    id: "search",
    element: '[data-tour="search"]',
    title: "Search",
    body: "Look up a title, an employer or a skill. Press / to jump here from anywhere.",
    side: "bottom",
  },
  {
    id: "filters",
    element: '[data-tour="filters"]',
    title: "Filter",
    body: "Narrow by work mode, term, location and level. More adds duration, job type, minimum pay and rating, and can hide postings that need citizenship, a security clearance or a driver's licence.",
    side: "bottom",
  },
  {
    id: "sort",
    element: '[data-tour="sort"]',
    title: "Sort",
    body: "Put your best matches first, or sort by deadline, pay or rating.",
    bodyWithoutResume: "Sort by deadline, pay or rating — or by match, once your resume is in.",
    side: "bottom",
  },
  {
    id: "card",
    element: '[data-tour="job-card"]',
    title: "Read a card",
    body: "Pay is coloured by tier: green is typical co-op pay, amber is well above it, red is $60/hr and up. The line under the closing date turns amber inside a week and red inside three days.",
    side: "right",
  },
  {
    id: "match",
    element: '[data-tour="job-card"] [data-match-ring]',
    title: "Your match",
    body: "How well your resume fits this posting: green from 80, amber from 60, red from 40.",
    side: "right",
    needsResume: true,
    optional: true,
  },
  {
    id: "facts",
    element: '[data-tour="detail-metrics"]',
    title: "The key facts",
    body: "Pay, the employer's rating from past co-op students, your match, and when applications close.",
    bodyWithoutResume: "Pay, the employer's rating from past co-op students, and when applications close.",
    side: "bottom",
    desktopOnly: true,
    inDetail: true,
  },
  {
    id: "glance",
    element: '[data-tour="glance"]',
    title: "What the job is",
    body: "A short summary, the requirements that might rule you out, and the skills it asks for — ticked where your resume shows them.",
    bodyWithoutResume: "A short summary, the requirements that might rule you out, and the skills it asks for.",
    side: "left",
    desktopOnly: true,
    inDetail: true,
  },
  {
    id: "skills",
    element: '[data-tour="glance-skills"]',
    title: "Tell it what you know",
    body: "Know a skill your resume doesn't show? Click it to add it. Click one you have to say how well you know it, or to take it off — your match scores follow.",
    side: "left",
    desktopOnly: true,
    inDetail: true,
    needsResume: true,
    optional: true,
  },
  {
    id: "save",
    element: '[data-tour="save"]',
    title: "Save it",
    body: "Keep the postings you like. Saved in the header shows just those.",
    side: "bottom",
    desktopOnly: true,
    inDetail: true,
  },
  {
    id: "apply",
    element: '[data-tour="apply"]',
    title: "Apply on WaterlooWorks",
    body: "Apply opens this posting on WaterlooWorks with its Apply button ready. Without the betterUWWorks extension you land on WaterlooWorks' search instead — the job ID is copied, so paste it there.",
    side: "bottom",
    desktopOnly: true,
    inDetail: true,
  },
  {
    id: "match-tab",
    element: '[data-tour="match-tab"]',
    title: "Why this score",
    body: "Match breakdown shows which skills and requirements you meet. Next opens it.",
    side: "bottom",
    desktopOnly: true,
    inDetail: true,
    needsResume: true,
    optional: true,
    clickOnNext: '[data-tour="match-tab"]',
  },
  {
    id: "advice",
    element: '[data-tour="advice"]',
    title: "Get application advice",
    body: "Press Get application advice for what to lead with, how to handle the skills you're missing, and what to check before you apply.",
    side: "top",
    desktopOnly: true,
    inDetail: true,
    needsResume: true,
    optional: true,
    waitMs: 3000,
  },
  {
    id: "cover",
    element: '[data-tour="cover-tab"]',
    title: "Draft a cover letter",
    body: "Cover letter writes one for this posting from your resume, to edit and copy. Tell it what to emphasize first if you like.",
    side: "bottom",
    desktopOnly: true,
    inDetail: true,
    needsResume: true,
    optional: true,
  },
  {
    id: "done",
    title: "You're set",
    body: "↑ and ↓ move through the list, / searches, and Esc closes a posting. Take this tour again any time from the ⋯ menu.",
    bodyWithoutResume:
      "↑ and ↓ move through the list, / searches, and Esc closes a posting. Once your resume is in, every posting shows how well it fits you — add it any time from the header. Take this tour again from the ⋯ menu.",
  },
];

export interface TourContext {
  hasResume: boolean;
  desktop: boolean;
  /**
   * intro: the welcome and the resume prompt, unnumbered. main: the numbered
   * tour, chosen once it is known whether a resume is on file — so its count
   * never includes steps that could only be skipped.
   */
  segment: "intro" | "main";
}

export function selectSteps(ctx: TourContext, steps: TourStepSpec[] = TOUR_STEPS): TourStepSpec[] {
  return steps
    .filter((s) => (ctx.segment === "intro" ? s.intro : !s.intro))
    .filter((s) => !(s.untilResume && ctx.hasResume))
    .filter((s) => !(s.needsResume && !ctx.hasResume))
    .filter((s) => !(s.desktopOnly && !ctx.desktop))
    .map((s) => (!ctx.hasResume && s.bodyWithoutResume ? { ...s, body: s.bodyWithoutResume } : s));
}

export function needsDetail(steps: TourStepSpec[]): boolean {
  return steps.some((s) => s.inDetail);
}
