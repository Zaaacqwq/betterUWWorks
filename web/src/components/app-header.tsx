"use client";

import { usePopover } from "@/hooks/use-popover";
import { BookmarkIcon, DocumentIcon, MoreIcon, RefreshIcon, TrashIcon } from "./icons";

export type ClearState = "idle" | "confirming" | "clearing";

interface AppHeaderProps {
  savedCount: number;
  showSavedOnly: boolean;
  onToggleSaved: () => void;
  hasResume: boolean;
  onOpenResume: () => void;
  onRefresh: () => void;
  /** Rows in the whole table; null when it couldn't be counted. */
  catalogTotal: number | null;
  clearState: ClearState;
  clearError: string | null;
  onClearAll: () => void;
  onCancelClear: () => void;
}

const HEADER_BUTTON =
  "h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[13px] font-medium transition-colors";

export function AppHeader({
  savedCount,
  showSavedOnly,
  onToggleSaved,
  hasResume,
  onOpenResume,
  ...menu
}: AppHeaderProps) {
  return (
    <header className="bg-canvas border-b border-hairline shrink-0">
      <div className="max-w-[1400px] mx-auto h-14 px-4 sm:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-primary text-on-primary grid place-items-center text-sm font-bold shrink-0">
            b
          </div>
          <h1 className="sr-only min-[440px]:not-sr-only text-[15px] font-semibold text-ink tracking-tight">betterUWWorks</h1>
        </div>

        <nav className="flex items-center gap-1">
          <button
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
          <button onClick={onOpenResume} className={`${HEADER_BUTTON} text-charcoal hover:bg-surface`}>
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
}: Pick<AppHeaderProps, "onRefresh" | "catalogTotal" | "clearState" | "clearError" | "onClearAll" | "onCancelClear">) {
  // Closing the menu backs out of a pending delete confirmation.
  const { open, setOpen, ref } = usePopover(onCancelClear);

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
        </div>
      )}
    </div>
  );
}
