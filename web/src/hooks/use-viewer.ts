"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Me } from "@/app/api/me/route";

// Who the page is being shown to, asked once and shared by every component
// that wants it (the header, the access card, the list). Until the server
// answers, nobody is treated as signed in or as the owner: an owner-only
// control appearing a moment late is better than a friend seeing one flash.

export interface ViewerState extends Me {
  loading: boolean;
}

const LOADING: ViewerState = {
  loading: true,
  signedIn: false,
  email: null,
  name: null,
  image: null,
  status: null,
  isAdmin: false,
};

let current: ViewerState = LOADING;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function refreshViewer(): Promise<void> {
  inflight ??= fetch("/api/me", { cache: "no-store" })
    .then((res) => res.json())
    .then((body) => {
      current = body?.success ? { ...body.data, loading: false } : { ...LOADING, loading: false };
    })
    .catch(() => {
      // Unreachable server: show the sign-in card rather than nothing.
      current = { ...LOADING, loading: false };
    })
    .finally(() => {
      inflight = null;
      listeners.forEach((notify) => notify());
    });
  return inflight;
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useViewer(): ViewerState {
  const viewer = useSyncExternalStore(subscribe, () => current, () => LOADING);
  useEffect(() => {
    if (current.loading) refreshViewer();
  }, []);
  return viewer;
}
