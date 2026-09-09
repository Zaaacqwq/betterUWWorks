"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface FilterOption {
  label: string;
  value: string;
}

interface Filters {
  location: string;
  level: string;
  arrangement: string;
  duration: string;
  workTerm: string;
  jobType: string;
  minPay: string;
  minRating: string;
  sort: string;
  order: "asc" | "desc";
}

interface FilterOptions {
  locations: FilterOption[];
  levels: FilterOption[];
  arrangements: FilterOption[];
  durations: FilterOption[];
  workTerms: FilterOption[];
  jobTypes: FilterOption[];
}

interface FilterBarProps {
  filters: Filters;
  options: FilterOptions;
  onChange: (key: keyof Filters, value: string) => void;
  total: number;
  activeFilterCount: number;
  onClearAll: () => void;
}

export function FilterBar({ filters, options, onChange, total, activeFilterCount, onClearAll }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate hover:text-ink transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Filters
          </button>
          {activeFilterCount > 0 && (
            <>
              <span className="text-[11px] font-bold text-on-primary bg-primary px-1.5 py-0.5 rounded-full leading-none">
                {activeFilterCount}
              </span>
              <button onClick={onClearAll} className="text-[11px] text-link-blue hover:underline">
                Clear
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone">{total} job{total !== 1 ? "s" : ""}</span>
          <span className="text-hairline-strong">|</span>
          <SingleSelect
            value={filters.sort}
            onChange={(v) => onChange("sort", v)}
            placeholder="Sort by"
            options={[
              { label: "Deadline", value: "deadline" },
              { label: "Match Score", value: "match" },
              { label: "Pay", value: "pay" },
              { label: "Rating", value: "rating" },

              { label: "Title", value: "title" },
            ]}
            noAll
          />
          <button
            onClick={() => onChange("order", filters.order === "asc" ? "desc" : "asc")}
            className="p-1.5 border border-hairline rounded-lg bg-canvas text-slate hover:text-ink transition-colors"
            title={filters.order === "asc" ? "Ascending" : "Descending"}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {filters.order === "asc" ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4-4v12m0 0l4-4m-4 4l-4-4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h9m4-8v12m0 0l4-4m-4 4l-4-4" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2 pt-1">
          <MultiSelect
            value={filters.arrangement}
            onChange={(v) => onChange("arrangement", v)}
            placeholder="Work Mode"
            options={options.arrangements}
          />
          <MultiSelect
            value={filters.location}
            onChange={(v) => onChange("location", v)}
            placeholder="Location"
            options={options.locations}
          />
          <MultiSelect
            value={filters.level}
            onChange={(v) => onChange("level", v)}
            placeholder="Level"
            options={options.levels}
          />
          <MultiSelect
            value={filters.workTerm}
            onChange={(v) => onChange("workTerm", v)}
            placeholder="Work Term"
            options={options.workTerms}
          />
          <MultiSelect
            value={filters.duration}
            onChange={(v) => onChange("duration", v)}
            placeholder="Duration"
            options={options.durations}
          />
          <MultiSelect
            value={filters.jobType}
            onChange={(v) => onChange("jobType", v)}
            placeholder="Job Type"
            options={options.jobTypes}
          />
          <input
            type="number"
            value={filters.minPay}
            onChange={(e) => onChange("minPay", e.target.value)}
            placeholder="Min $/hr"
            className="w-24 px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-xs text-charcoal focus:outline-none focus:border-primary"
          />
          <input
            type="number"
            step="0.1"
            min="0"
            max="10"
            value={filters.minRating}
            onChange={(e) => onChange("minRating", e.target.value)}
            placeholder="Min Rating"
            className="w-24 px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-xs text-charcoal focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  );
}

function MultiSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: FilterOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(",") : [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggle = useCallback(
    (val: string) => {
      const next = selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val];
      onChange(next.join(","));
    },
    [selected, onChange]
  );

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label.replace(/\s*\(\d+\)$/, "") ?? selected[0]
        : `${placeholder} (${selected.length})`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-lg bg-canvas text-xs focus:outline-none focus:border-primary transition-colors ${
          selected.length > 0
            ? "border-primary/40 text-charcoal font-medium"
            : "border-hairline text-stone"
        }`}
      >
        <span className="truncate max-w-[140px]">{label}</span>
        <svg className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-56 max-h-64 overflow-y-auto bg-canvas border border-hairline rounded-lg shadow-lg py-1">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="w-3.5 h-3.5 rounded border-hairline-strong text-primary focus:ring-primary/30 accent-primary"
              />
              <span className="text-xs text-charcoal truncate">{o.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-stone px-3 py-2">No options</p>
          )}
        </div>
      )}
    </div>
  );
}

function SingleSelect({
  value,
  onChange,
  placeholder,
  options,
  noAll,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: FilterOption[];
  noAll?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-2.5 py-1.5 border border-hairline rounded-lg bg-canvas text-xs focus:outline-none focus:border-primary ${
        value ? "text-charcoal font-medium" : "text-stone"
      }`}
    >
      {!noAll && <option value="">All {placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
