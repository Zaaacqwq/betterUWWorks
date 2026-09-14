"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { needsDetail, selectSteps, type TourStepSpec } from "@/lib/onboarding/steps";
import { markTourSeen, tourSeen } from "@/lib/onboarding/storage";

// Runs the first-visit tour (lib/onboarding/steps.ts) with driver.js, in two
// parts. The intro — welcome, then the resume prompt — is unnumbered. The main
// tour is only put together once the resume question is settled, so a visitor
// who skips the upload gets a count without the match-score steps rather than
// a tour that stalls looking for them. The upload itself hands over to the
// resume dialog; the main tour starts when the dialog closes.

// Where the detail pane sits beside the list (Tailwind's lg).
const DESKTOP_QUERY = "(min-width: 1024px)";
// A posting's detail is fetched when it opens; give it time to arrive.
const DETAIL_WAIT_MS = 8000;
// Let the list finish drawing before the first highlight lands on it.
const AUTO_START_DELAY_MS = 700;
// The dialog usually closes on Esc; starting at once, the tour caught that
// key's release and closed itself. Also lets the dialog finish leaving.
const RESUME_HANDBACK_MS = 400;

// What closing the current part leads to.
type After = "end" | "main" | "await-resume";

const SHARED = {
  popoverClass: "buw-tour",
  nextBtnText: "Next",
  prevBtnText: "Back",
  doneBtnText: "Done",
  overlayColor: "#000",
  overlayOpacity: 0.55,
  stagePadding: 6,
  stageRadius: 10,
  // A stray click beside the popover shouldn't end a newcomer's tour; the ×
  // and Esc still do.
  overlayClickBehavior: () => {},
} as const;

interface OnboardingTourProps {
  /** Approved, and the list has postings to point at. */
  ready: boolean;
  hasResume: boolean;
  resumeOpen: boolean;
  onOpenResume: () => void;
  /** Open the first posting in the detail pane, if none is open. */
  onOpenFirstJob: () => void;
  /** Bumped by "Take the tour" in the menu. */
  startRequest: number;
}

export function OnboardingTour({
  ready,
  hasResume,
  resumeOpen,
  onOpenResume,
  onOpenFirstJob,
  startRequest,
}: OnboardingTourProps) {
  const tourRef = useRef<Driver | null>(null);
  const after = useRef<After>("end");
  const autoStarted = useRef(false);
  // driver.js holds on to its callbacks; they read the latest props from here.
  const latest = useRef({ hasResume, onOpenResume, onOpenFirstJob });
  useEffect(() => {
    latest.current = { hasResume, onOpenResume, onOpenFirstJob };
  });

  const start = useCallback((steps: DriveStep[], showProgress: boolean, onEnd: () => void) => {
    tourRef.current?.destroy();
    after.current = "end";
    const tour = driver({
      ...SHARED,
      steps,
      showProgress,
      progressText: "{{current}} of {{total}}",
      onDestroyed: () => {
        tourRef.current = null;
        onEnd();
      },
    });
    tourRef.current = tour;
    tour.drive();
  }, []);

  const runMain = useCallback(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const specs = selectSteps({ segment: "main", hasResume: latest.current.hasResume, desktop });
    if (needsDetail(specs)) latest.current.onOpenFirstJob();
    start(specs.map((spec) => toDriveStep(spec)), true, markTourSeen);
  }, [start]);

  const runIntro = useCallback(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY).matches;
    const specs = selectSteps({ segment: "intro", hasResume: latest.current.hasResume, desktop });
    const leave = (next: After) => {
      after.current = next;
      tourRef.current?.destroy();
    };
    const steps = specs.map((spec, i) =>
      toDriveStep(spec, {
        isLast: i === specs.length - 1,
        onContinue: () => leave("main"),
        onUploadResume: () => {
          leave("await-resume");
          latest.current.onOpenResume();
        },
      })
    );
    start(steps, false, () => {
      if (after.current === "main") runMain();
      // Closed with × or Esc: that is an answer too.
      else if (after.current === "end") markTourSeen();
      // "await-resume": the dialog's closing picks it up (effect below).
    });
  }, [start, runMain]);

  // First visit: once there is something to point at.
  useEffect(() => {
    if (!ready || autoStarted.current || tourSeen()) return;
    const timer = setTimeout(() => {
      autoStarted.current = true;
      runIntro();
    }, AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, runIntro]);

  // Back from the upload dialog, resume on file or not: on to the main tour.
  useEffect(() => {
    if (after.current !== "await-resume" || resumeOpen) return;
    const timer = setTimeout(() => {
      after.current = "end";
      runMain();
    }, RESUME_HANDBACK_MS);
    return () => clearTimeout(timer);
  }, [resumeOpen, runMain]);

  // "Take the tour" from the menu.
  useEffect(() => {
    if (startRequest > 0) runIntro();
  }, [startRequest, runIntro]);

  useEffect(() => () => tourRef.current?.destroy(), []);

  return null;
}

interface IntroHooks {
  isLast: boolean;
  onContinue: () => void;
  onUploadResume: () => void;
}

function toDriveStep(spec: TourStepSpec, intro?: IntroHooks): DriveStep {
  const step: DriveStep = {
    element: spec.element,
    // Absent is normal for these: skip at once rather than stall.
    skipMissingElement: spec.optional || spec.inDetail,
    // Only a step the tour itself is waiting to load (the posting it opened)
    // is worth waiting for.
    waitForElement: spec.inDetail && !spec.optional ? DETAIL_WAIT_MS : undefined,
    popover: {
      title: spec.title,
      description: spec.body,
      side: spec.side,
      align: "start",
    },
  };
  if (!intro) return step;

  step.popover = {
    ...step.popover,
    showButtons: ["next", "close"],
    // The intro's last step leads into the main tour instead of ending.
    ...(intro.isLast && { onNextClick: intro.onContinue }),
  };
  if (spec.id === "welcome") {
    step.popover = { ...step.popover, nextBtnText: intro.isLast ? "Start tour" : "Next" };
  }
  if (spec.id === "resume") {
    step.popover = {
      ...step.popover,
      popoverClass: "buw-tour buw-tour-resume",
      nextBtnText: "Skip for now",
      onPopoverRender: (popover) => {
        const upload = document.createElement("button");
        upload.type = "button";
        upload.className = "buw-tour-cta";
        upload.textContent = "Upload resume";
        upload.addEventListener("click", intro.onUploadResume);
        popover.footerButtons.prepend(upload);
      },
    };
  }
  return step;
}
