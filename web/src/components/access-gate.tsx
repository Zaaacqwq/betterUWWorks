"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { refreshViewer, type ViewerState } from "@/hooks/use-viewer";

// Laid over the list until the viewer has been let in: a sign-in card for
// someone signed out, a waiting card while the owner decides. The postings
// behind it never load — the server refuses them — so this is the whole of
// what a stranger sees.

const BUTTON =
  "h-9 w-full flex items-center justify-center gap-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50";

// Auth.js sends a refused sign-in back here as ?error=...
function signInError(): string | null {
  if (typeof window === "undefined") return null;
  const error = new URLSearchParams(window.location.search).get("error");
  if (!error) return null;
  return error === "AccessDenied"
    ? "That Google account couldn't be used: its email address isn't verified with Google."
    : "Signing in didn't finish. Try again.";
}

export function AccessGate({ viewer }: { viewer: ViewerState }) {
  const [busy, setBusy] = useState(false);
  const [error] = useState(signInError);

  if (viewer.loading || viewer.status === "approved") return null;

  const start = () => {
    setBusy(true);
    signIn("google", { redirectTo: window.location.pathname });
  };
  const switchAccount = () => {
    setBusy(true);
    signOut({ redirectTo: "/" });
  };
  const checkAgain = async () => {
    setBusy(true);
    await refreshViewer();
    setBusy(false);
  };

  let title: string;
  let body: React.ReactNode;
  let actions: React.ReactNode;

  if (!viewer.signedIn) {
    title = "Sign in to continue";
    body = "Sign in with Google to browse the postings. A new account waits for the owner to approve it.";
    actions = (
      <button onClick={start} disabled={busy} className={`${BUTTON} border border-hairline bg-surface text-charcoal hover:bg-surface-soft`}>
        <GoogleMark />
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
    );
  } else if (viewer.status === "blocked") {
    title = "No access";
    body = (
      <>
        <b className="font-medium text-charcoal">{viewer.email}</b> doesn&apos;t have access to this site. If that&apos;s a
        mistake, ask the person who invited you.
      </>
    );
    actions = (
      <button onClick={switchAccount} disabled={busy} className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}>
        Use a different account
      </button>
    );
  } else {
    title = "Waiting for approval";
    body = (
      <>
        You&apos;re signed in as <b className="font-medium text-charcoal">{viewer.email}</b>. The owner has been told you&apos;d
        like access; the postings appear here once they approve you.
      </>
    );
    actions = (
      <div className="flex gap-2">
        <button onClick={checkAgain} disabled={busy} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-pressed`}>
          {busy ? "Checking…" : "Check again"}
        </button>
        <button onClick={switchAccount} disabled={busy} className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}>
          Use a different account
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-surface/55 backdrop-blur-[3px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-title"
        className="w-full max-w-[400px] rounded-xl border border-hairline bg-canvas p-5 shadow-[var(--shadow-pop)] space-y-3"
      >
        <h2 id="access-title" className="text-[15px] font-semibold text-ink">
          {title}
        </h2>
        <p className="text-[13px] leading-relaxed text-slate">{body}</p>
        {error && !viewer.signedIn && <p className="text-[12.5px] text-poor">{error}</p>}
        <div className="pt-1">{actions}</div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
