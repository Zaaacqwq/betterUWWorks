"use client";

import { useCallback, useEffect, useState } from "react";
import { useViewer } from "@/hooks/use-viewer";

// The daily AI allowances, changed here rather than in the code: they take
// effect within a few seconds, for everyone but the owner.

interface Limits {
  match: number;
  summary: number;
  resume: number;
  cover: number;
  fullChecks: number;
}

const FIELDS: { key: keyof Limits; label: string; note: string }[] = [
  { key: "cover", label: "Cover letters", note: "one call each" },
  { key: "match", label: "Application advice", note: "one call each" },
  { key: "summary", label: "Posting summaries", note: "only postings nobody has opened yet" },
  { key: "resume", label: "Resume readings", note: "each upload or re-analyse" },
  { key: "fullChecks", label: "Full resume checks", note: "each is a pass over every open posting" },
];

export function AdminLimits() {
  const viewer = useViewer();
  const [limits, setLimits] = useState<Limits | null>(null);
  const [defaults, setDefaults] = useState<Limits | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/limits", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      setError(json?.error ?? "Couldn't read the allowances.");
      return;
    }
    setLimits(json.data.limits);
    setDefaults(json.data.defaults);
  }, []);

  useEffect(() => {
    if (!viewer.isAdmin) return;
    // Off the render pass: the answer, not the asking, is what sets state.
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [viewer.isAdmin, load]);

  if (!viewer.isAdmin || !limits || !defaults) return null;

  const save = async () => {
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(limits),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? `The server answered ${res.status}.`);
      setLimits(json.data.limits);
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Couldn't save the allowances.");
    }
  };

  const changed = FIELDS.some(({ key }) => limits[key] !== defaults[key]);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Daily allowances</h2>
        <span className="text-[12px] text-stone">per friend, resets at midnight in Waterloo</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {FIELDS.map(({ key, label, note }) => (
          <label key={key} className="flex items-center gap-3 rounded-lg border border-hairline px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-ink">{label}</span>
              <span className="block text-[11.5px] text-stone">{note}</span>
            </span>
            <input
              type="number"
              min={0}
              max={key === "fullChecks" ? 50 : 10000}
              value={limits[key]}
              onChange={(e) => setLimits({ ...limits, [key]: Math.max(0, Number(e.target.value) || 0) })}
              className="h-8 w-20 px-2 text-right tabular-nums rounded-lg border border-hairline bg-canvas text-[13px] text-ink focus:outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={state === "saving"}
          className="h-8 px-3 rounded-lg bg-primary text-on-primary text-[12.5px] font-medium hover:bg-primary-pressed disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </button>
        {changed && (
          <button onClick={() => setLimits(defaults)} className="text-[12.5px] text-steel hover:text-charcoal">
            Back to the defaults
          </button>
        )}
        {error && <span className="text-[12.5px] text-poor">{error}</span>}
      </div>
      <p className="text-[11.5px] text-stone">
        You aren&apos;t counted against any of these. A change reaches the running site within a few seconds.
      </p>
    </section>
  );
}
