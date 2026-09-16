"use client";

// Moving through a long list: a step either way, a jump to the first or last
// page, and a box to type the page you want.

const BUTTON =
  "h-8 min-w-8 px-2 text-[13px] font-medium rounded-lg border border-hairline bg-canvas text-charcoal hover:bg-surface-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const go = (to: number) => onChange(Math.max(1, Math.min(totalPages, to)));

  const submit = (input: HTMLInputElement) => {
    const wanted = Number.parseInt(input.value, 10);
    if (Number.isFinite(wanted)) go(wanted);
    // Whatever was typed, the box goes back to showing where the list is.
    input.value = String(page);
    input.blur();
  };

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4 pb-2">
      <button onClick={() => go(1)} disabled={page <= 1} className={BUTTON} aria-label="First page" title="First page">
        «
      </button>
      <button onClick={() => go(page - 1)} disabled={page <= 1} className={BUTTON}>
        Previous
      </button>

      <div className="flex items-center gap-1.5 px-1 text-[12.5px] text-steel">
        <input
          // Remounted on every page change, so the box follows the list
          // whenever the page changes some other way.
          key={page}
          defaultValue={page}
          inputMode="numeric"
          aria-label={`Page number, ${totalPages} pages in all`}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit(e.currentTarget);
            if (e.key === "Escape") {
              e.currentTarget.value = String(page);
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            if (e.currentTarget.value !== String(page)) submit(e.currentTarget);
          }}
          className="h-8 w-12 px-1.5 text-center tabular-nums rounded-lg border border-hairline bg-canvas text-[13px] text-ink focus:outline-none focus:border-primary"
        />
        <span className="tabular-nums whitespace-nowrap">of {totalPages}</span>
      </div>

      <button onClick={() => go(page + 1)} disabled={page >= totalPages} className={BUTTON}>
        Next
      </button>
      <button
        onClick={() => go(totalPages)}
        disabled={page >= totalPages}
        className={BUTTON}
        aria-label="Last page"
        title="Last page"
      >
        »
      </button>
    </div>
  );
}
