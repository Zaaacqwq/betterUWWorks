"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { parseChoice, resolveTheme, THEME_KEY, type ThemeChoice } from "@/lib/theme";

const listeners = new Set<() => void>();
const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function readChoice(): ThemeChoice {
  try {
    return parseChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches);
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);

  // Following the system means following it when it changes, too.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Blocked storage: the theme still changes, it just isn't remembered.
    }
    apply(next);
    for (const cb of listeners) cb();
  }, []);

  return { choice, setChoice };
}
