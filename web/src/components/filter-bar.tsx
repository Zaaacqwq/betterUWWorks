"use client";

import { usePopover } from "@/hooks/use-popover";
import type { Filters } from "./types/job";
import { HIDEABLE_REQUIREMENTS } from "@/lib/job-details/present";
import { ArrowIcon, ChevronDownIcon, CloseIcon, PlusIcon } from "./icons";

interface FilterOption {
  label: string;
  value: string;
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
  activeFilterCount: number;
  onClearAll: () => void;
  shownCount: number;
  /** Rows in the whole table; null when it couldn't be counted. */
  catalogTotal: number | null;
  loading: boolean;
}

const SORT_OPTIONS: FilterOption[] = [
  { label: "Match", value: "match" },
  { label: "Deadline", value: "deadline" },
  { label: "Pay", value: "pay" },
  { label: "Rating", value: "rating" },
  { label: "Title", value: "title" },
];

const REQUIREMENT_OPTIONS: FilterOption[] = HIDEABLE_REQUIREMENTS.map((r) => ({ label: r.label, value: r.kind }));

function hiddenLabel(value: string): string {
  const names = value
    .split(",")
    .map((kind) => HIDEABLE_REQUIREMENTS.find((r) => r.kind === kind)?.label)
    .filter(Boolean);
  return names.length === 1 ? `Hide: ${names[0]}` : `Hiding ${names.length} requirements`;
}

const POPOVER =
  "absolute z-30 mt-1.5 left-0 bg-canvas border border-hairline rounded-lg shadow-[var(--shadow-pop)]";

export function FilterBar({
  filters,
  options,
  onChange,
  activeFilterCount,
  onClearAll,
  shownCount,
  catalogTotal,
  loading,
}: FilterBarProps) {
  const set = (key: keyof Filters) => (v: string) => onChange(key, v);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-1">
        <MultiSelectChip name="Work mode" value={filters.arrangement} options={options.arrangements} onChange={set("arrangement")} />
        <MultiSelectChip name="Work term" value={filters.workTerm} options={options.workTerms} onChange={set("workTerm")} />
        <MultiSelectChip name="Location" value={filters.location} options={options.locations} onChange={set("location")} />
        <MultiSelectChip name="Level" value={filters.level} options={options.levels} onChange={set("level")} />
        {filters.duration && (
          <MultiSelectChip name="Duration" value={filters.duration} options={options.durations} onChange={set("duration")} />
        )}
        {filters.jobType && (
          <MultiSelectChip name="Job type" value={filters.jobType} options={options.jobTypes} onChange={set("jobType")} />
        )}
        {filters.minPay && <ValueChip label={`≥ $${filters.minPay}/hr`} onClear={() => onChange("minPay", "")} />}
        {filters.minRating && <ValueChip label={`Rating ≥ ${filters.minRating}`} onClear={() => onChange("minRating", "")} />}
        {filters.hideRequirement && (
          <ValueChip label={hiddenLabel(filters.hideRequirement)} onClear={() => onChange("hideRequirement", "")} />
        )}
        <MoreFilters filters={filters} options={options} onChange={onChange} />
        {activeFilterCount > 0 && (
          <button onClick={onClearAll} className="h-7 px-1.5 text-[12.5px] text-steel hover:text-ink transition-colors">
            Clear all
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-[12.5px] px-0.5">
        <p className="text-steel tabular-nums">
          {loading ? (
            "Loading jobs…"
          ) : catalogTotal == null || shownCount === catalogTotal ? (
            <><span className="font-semibold text-ink">{shownCount}</span> jobs</>
          ) : (
            <><span className="font-semibold text-ink">{shownCount}</span> of {catalogTotal} jobs</>
          )}
        </p>
        <div className="flex items-center gap-1">
          <label htmlFor="sort-by" className="text-steel">Sort</label>
          <span className="relative flex items-center">
            <select
              id="sort-by"
              value={filters.sort}
              onChange={(e) => onChange("sort", e.target.value)}
              className="appearance-none bg-transparent pr-4 font-medium text-charcoal cursor-pointer focus:outline-none focus-visible:underline"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDownIcon className="w-3 h-3 absolute right-0 pointer-events-none text-steel" />
          </span>
          <button
            onClick={() => onChange("order", filters.order === "asc" ? "desc" : "asc")}
            className="w-6 h-6 flex items-center justify-center rounded text-charcoal hover:bg-hairline-soft transition-colors"
            aria-label={filters.order === "asc" ? "Ascending, switch to descending" : "Descending, switch to ascending"}
            title={filters.order === "asc" ? "Ascending" : "Descending"}
          >
            <ArrowIcon up={filters.order === "asc"} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Option labels arrive as "Toronto (23)"; the count reads better set apart.
function splitCount(label: string): { name: string; count: string | null } {
  const match = label.match(/^(.*)\s\((\d+)\)$/);
  return match ? { name: match[1], count: match[2] } : { name: label, count: null };
}

const chipClass = (active: boolean) =>
  `h-7 flex items-center rounded-full border text-[12.5px] font-medium transition-colors ${
    active
      ? "bg-primary-tint border-primary-line text-primary-deep"
      : "bg-canvas border-hairline text-charcoal hover:border-hairline-strong"
  }`;

function MultiSelectChip({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();
  const selected = value ? value.split(",") : [];

  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val];
    onChange(next.join(","));
  };

  const names = selected.map((v) => splitCount(options.find((o) => o.value === v)?.label ?? v).name);
  const joined = names.join(", ");
  const label = selected.length === 0 ? name : joined.length <= 24 ? joined : `${name} · ${selected.length}`;

  return (
    <div ref={ref} className="relative">
      <div className={chipClass(selected.length > 0)}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          title={selected.length > 0 ? `${name}: ${joined}` : undefined}
          className={`h-full flex items-center gap-0.5 pl-2.5 ${selected.length > 0 ? "pr-1" : "pr-2"}`}
        >
          <span className="truncate max-w-[160px]">{label}</span>
          {selected.length === 0 && <ChevronDownIcon />}
        </button>
        {selected.length > 0 && (
          <button
            onClick={() => onChange("")}
            aria-label={`Clear ${name}`}
            className="h-full pl-0.5 pr-2 opacity-60 hover:opacity-100"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div className={`${POPOVER} w-64 max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto py-1`}>
          {options.map((o) => {
            const { name: optName, count } = splitCount(o.label);
            return (
              <label key={o.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => toggle(o.value)}
                  className="w-3.5 h-3.5 accent-primary shrink-0"
                />
                <span className="text-[12.5px] text-charcoal truncate min-w-0">{optName}</span>
                {count && <span className="ml-auto text-xs text-stone tabular-nums">{count}</span>}
              </label>
            );
          })}
          {options.length === 0 && <p className="text-xs text-stone px-3 py-2">No options in the current jobs</p>}
        </div>
      )}
    </div>
  );
}

function ValueChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className={chipClass(true)}>
      <span className="pl-2.5 pr-1">{label}</span>
      <button onClick={onClear} aria-label={`Remove ${label}`} className="h-full pl-0.5 pr-2 opacity-60 hover:opacity-100">
        <CloseIcon className="w-3 h-3" />
      </button>
    </div>
  );
}

function MoreFilters({
  filters,
  options,
  onChange,
}: {
  filters: Filters;
  options: FilterOptions;
  onChange: (key: keyof Filters, value: string) => void;
}) {
  const { open, setOpen, ref } = usePopover();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`${chipClass(false)} gap-1 pl-2 pr-2.5 text-slate`}
      >
        <PlusIcon />
        More
      </button>

      {open && (
        <div className={`${POPOVER} w-72 max-w-[calc(100vw-2rem)] p-3 space-y-3`}>
          <CheckGroup
            title="Duration"
            value={filters.duration}
            options={options.durations}
            onChange={(v) => onChange("duration", v)}
          />
          <CheckGroup
            title="Job type"
            value={filters.jobType}
            options={options.jobTypes}
            onChange={(v) => onChange("jobType", v)}
          />
          <CheckGroup
            title="Hide postings that require"
            value={filters.hideRequirement}
            options={REQUIREMENT_OPTIONS}
            onChange={(v) => onChange("hideRequirement", v)}
          />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <NumberField
              id="filter-min-pay"
              label="Min pay ($/hr)"
              value={filters.minPay}
              placeholder="e.g. 25"
              onChange={(v) => onChange("minPay", v)}
            />
            <NumberField
              id="filter-min-rating"
              label="Min rating (0–10)"
              value={filters.minRating}
              placeholder="e.g. 8"
              step="0.1"
              max="10"
              onChange={(v) => onChange("minRating", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CheckGroup({
  title,
  value,
  options,
  onChange,
}: {
  title: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(",") : [];
  const toggle = (val: string) =>
    onChange((selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]).join(","));

  return (
    <fieldset>
      <legend className="text-xs font-semibold text-charcoal mb-1">{title}</legend>
      <div className="max-h-32 overflow-y-auto -mx-1">
        {options.map((o) => {
          const { name, count } = splitCount(o.label);
          return (
            <label key={o.value} className="flex items-center gap-2.5 px-1 py-1 rounded hover:bg-surface cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="w-3.5 h-3.5 accent-primary shrink-0"
              />
              <span className="text-[12.5px] text-charcoal truncate min-w-0">{name}</span>
              {count && <span className="ml-auto text-xs text-stone tabular-nums">{count}</span>}
            </label>
          );
        })}
        {options.length === 0 && <p className="text-xs text-stone px-1 py-1">None in the current jobs</p>}
      </div>
    </fieldset>
  );
}

function NumberField({
  id,
  label,
  value,
  placeholder,
  step,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  step?: string;
  max?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-charcoal mb-1">{label}</label>
      <input
        id={id}
        type="number"
        min="0"
        step={step}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2.5 border border-hairline rounded-lg bg-canvas text-[12.5px] text-charcoal focus:outline-none focus:border-primary"
      />
    </div>
  );
}
