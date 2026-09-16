"use client";

import { useState } from "react";

// The resumes one student keeps here, for the owner to look at. Everything on
// this server is already the owner's to read; this saves opening the database,
// and the privacy page tells students it can be done.

interface ResumeRow {
  id: string;
  label: string | null;
  fileName: string | null;
  active: boolean;
  version: number;
  updatedAt: string;
  lines: number;
  checked: number;
}

export function UserResumes({ email }: { email: string }) {
  const [rows, setRows] = useState<ResumeRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<{ id: string; label: string; body: string } | null>(null);
  const [error, setError] = useState("");

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (rows) return;
    try {
      const res = await fetch(`/api/admin/resumes?email=${encodeURIComponent(email)}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRows(json.data.resumes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read their resumes.");
    }
  };

  const read = async (row: ResumeRow) => {
    setError("");
    try {
      const res = await fetch(`/api/admin/resumes?email=${encodeURIComponent(email)}&id=${row.id}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setText({ id: row.id, label: row.label ?? row.fileName ?? "Resume", body: json.data.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open that resume.");
    }
  };

  return (
    <div className="pl-11 space-y-2">
      <button onClick={toggle} aria-expanded={open} className="text-[12px] text-steel hover:text-charcoal">
        {open ? "Hide resumes" : "Resumes"}
      </button>
      {error && <p className="text-[12px] text-poor">{error}</p>}

      {open && (
        rows === null ? (
          <p className="text-[12px] text-stone">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-[12px] text-stone">They haven&apos;t uploaded one.</p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-charcoal">{row.label ?? row.fileName ?? "Resume"}</span>
                {row.active && <span className="text-[10.5px] text-good bg-good/10 px-1.5 rounded-full">in use</span>}
                <span className="text-stone">
                  v{row.version} · {row.lines} lines · {row.checked.toLocaleString()} checked ·{" "}
                  {new Date(row.updatedAt).toLocaleDateString()}
                </span>
                <button onClick={() => read(row)} className="text-primary hover:underline">
                  {text?.id === row.id ? "Reload" : "Open"}
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {open && text && (
        <div className="rounded-lg border border-hairline bg-canvas">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-hairline-soft">
            <span className="text-[12px] text-charcoal">{text.label}</span>
            <button onClick={() => setText(null)} className="text-[12px] text-steel hover:text-charcoal">
              Close
            </button>
          </div>
          <pre className="max-h-72 overflow-auto px-3 py-2 text-[11.5px] leading-relaxed text-slate whitespace-pre-wrap">
            {text.body}
          </pre>
        </div>
      )}
    </div>
  );
}
