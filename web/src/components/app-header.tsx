"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePopover } from "@/hooks/use-popover";
import { BookmarkIcon, DocumentIcon, HideIcon, MoreIcon, PeopleIcon, RefreshIcon, ShieldIcon, SparklesIcon, TrashIcon } from "./icons";
import { useTheme } from "@/hooks/use-theme";
import { ExtractionStatus } from "./extraction-status";
import { useViewer } from "@/hooks/use-viewer";
import type { ThemeChoice } from "@/lib/theme";

export type ClearState = "idle" | "confirming" | "clearing";

interface AppHeaderProps {
  savedCount: number;
  showSavedOnly: boolean;
  onToggleSaved: () => void;
  hiddenCount: number;
  showHiddenOnly: boolean;
  onToggleHiddenOnly: () => void;
  hasResume: boolean;
  onOpenResume: () => void;
  onRefresh: () => void;
  /** Rows in the whole table; null when it couldn't be counted. */
  catalogTotal: number | null;
  clearState: ClearState;
  clearError: string | null;
  onClearAll: () => void;
  onCancelClear: () => void;
  onStartTour: () => void;
}

const HEADER_BUTTON =
  "h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[13px] font-medium transition-colors";

export function AppHeader({
  savedCount,
  showSavedOnly,
  onToggleSaved,
  hiddenCount,
  showHiddenOnly,
  onToggleHiddenOnly,
  hasResume,
  onOpenResume,
  ...menu
}: AppHeaderProps) {
  return (
    <header className="bg-canvas border-b border-hairline shrink-0">
      <div className="h-14 px-4 sm:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image src="/logo.png" alt="" width={38} height={22} priority className="shrink-0" />
          <h1 className="sr-only min-[440px]:not-sr-only text-[15px] font-semibold text-ink tracking-tight">betterUWWorks</h1>
        </div>

        <nav className="flex items-center gap-1">
          <button
            data-tour="saved"
            onClick={onToggleSaved}
            aria-pressed={showSavedOnly}
            className={`${HEADER_BUTTON} ${
              showSavedOnly ? "bg-primary-tint text-primary-deep" : "text-charcoal hover:bg-surface"
            }`}
          >
            <BookmarkIcon className="w-3.5 h-3.5" filled={showSavedOnly} />
            Saved
            {savedCount > 0 && (
              <span className={`tabular-nums ${showSavedOnly ? "text-primary" : "text-steel"}`}>{savedCount}</span>
            )}
          </button>
          {(hiddenCount > 0 || showHiddenOnly) && (
            <button
              onClick={onToggleHiddenOnly}
              aria-pressed={showHiddenOnly}
              title="Postings you said you're not interested in"
              className={`${HEADER_BUTTON} ${
                showHiddenOnly ? "bg-primary-tint text-primary-deep" : "text-steel hover:bg-surface hover:text-charcoal"
              }`}
            >
              <HideIcon className="w-3.5 h-3.5" filled={showHiddenOnly} />
              <span className="hidden sm:inline">Not interested</span>
              <span className={`tabular-nums ${showHiddenOnly ? "text-primary" : "text-steel"}`}>{hiddenCount}</span>
            </button>
          )}
          <button data-tour="resume" onClick={onOpenResume} className={`${HEADER_BUTTON} text-charcoal hover:bg-surface`}>
            {hasResume ? (
              <>
                <span className="w-[7px] h-[7px] rounded-full bg-good" aria-hidden />
                Resume
              </>
            ) : (
              <>
                <DocumentIcon className="w-3.5 h-3.5" />
                Add resume
              </>
            )}
          </button>
          <HeaderMenu {...menu} />
        </nav>
      </div>
    </header>
  );
}

function HeaderMenu({
  onRefresh,
  catalogTotal,
  clearState,
  clearError,
  onClearAll,
  onCancelClear,
  onStartTour,
}: Pick<AppHeaderProps, "onRefresh" | "catalogTotal" | "clearState" | "clearError" | "onClearAll" | "onCancelClear" | "onStartTour">) {
  // Closing the menu backs out of a pending delete confirmation.
  const { open, setOpen, ref } = usePopover(onCancelClear);
  // Deleting, starting readings and letting people in are the owner's;
  // friends get the rest.
  const viewer = useViewer();
  const { isAdmin } = viewer;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More actions"
        className={`${HEADER_BUTTON} w-8 justify-center px-0 text-charcoal hover:bg-surface ${open ? "bg-surface" : ""}`}
      >
        <MoreIcon />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-64 bg-canvas border border-hairline rounded-lg shadow-[var(--shadow-pop)] p-1"
        >
          <button
            role="menuitem"
            onClick={() => {
              onRefresh();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-charcoal hover:bg-surface"
          >
            <RefreshIcon className="w-4 h-4 text-steel" />
            Refresh jobs
          </button>

          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onStartTour();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-charcoal hover:bg-surface"
          >
            <SparklesIcon className="w-4 h-4 text-steel" />
            Take the tour
          </button>

          <Link
            role="menuitem"
            href="/privacy"
            onClick={() => setOpen(false)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-charcoal hover:bg-surface"
          >
            <ShieldIcon className="w-4 h-4 text-steel" />
            Privacy
          </Link>

          <ThemeSwitch />

          {isAdmin && (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-charcoal hover:bg-surface"
            >
              <PeopleIcon className="w-4 h-4 text-steel" />
              Manage access
            </Link>
          )}

          {viewer.email && (
            <button
              role="menuitem"
              onClick={() => signOut({ redirectTo: "/" })}
              className="w-full flex flex-col items-start px-2.5 py-2 rounded-md text-[13px] text-charcoal text-left hover:bg-surface"
            >
              Sign out
              <span className="text-[11.5px] text-stone truncate max-w-full">{viewer.email}</span>
            </button>
          )}

          <div className="my-1 border-t border-hairline-soft" />

          <ExtractionStatus canStart={isAdmin} />

          {isAdmin && (
            <>
              <div className="my-1 border-t border-hairline-soft" />

              <button
                role="menuitem"
                onClick={onClearAll}
                disabled={clearState === "clearing" || !catalogTotal}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  clearState === "confirming"
                    ? "bg-poor text-white hover:bg-poor/90"
                    : "text-poor hover:bg-error/5"
                }`}
              >
                <TrashIcon className="w-4 h-4 shrink-0" />
                {clearState === "clearing"
                  ? "Deleting…"
                  : clearState === "confirming"
                    ? `Click again to delete all ${catalogTotal}`
                    : catalogTotal == null
                      ? "Delete all jobs…"
                      : `Delete all ${catalogTotal} jobs…`}
              </button>
              <p className={`px-2.5 pt-1 pb-1.5 text-xs ${clearError ? "text-poor" : "text-stone"}`}>
                {clearError ??
                  (catalogTotal == null
                    ? "Couldn't count the jobs, so delete is off. Refresh to try again."
                    : "A copy of the deleted jobs is kept until the next delete.")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function ThemeSwitch() {
  const { choice, setChoice } = useTheme();
  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-2">
      <span className="text-[13px] text-charcoal">Theme</span>
      <div role="radiogroup" aria-label="Theme" className="flex p-0.5 rounded-md bg-surface border border-hairline-soft">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={choice === o.value}
            onClick={() => setChoice(o.value)}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              choice === o.value ? "bg-canvas text-ink shadow-sm" : "text-steel hover:text-charcoal"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
