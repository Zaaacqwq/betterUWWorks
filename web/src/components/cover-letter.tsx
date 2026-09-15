"use client";

import { useRef, useState } from "react";
import { useResume } from "@/hooks/use-resume";
import type { JobDetail } from "./types/job";
import { CopyIcon, SparklesIcon } from "./icons";

// A cover letter for this posting, drafted from the student's resume and
// streamed in as it is written. The draft is theirs to edit; it is kept per
// posting in this browser, so coming back to it doesn't cost another call.

const CACHE_PREFIX = "buw-cover:";

interface Saved {
  text: string;
  note: string;
  at: string;
}

function readSaved(jobId: string): Saved | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + jobId);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(jobId: string, saved: Saved) {
  try {
    localStorage.setItem(CACHE_PREFIX + jobId, JSON.stringify(saved));
  } catch {
    // Full or blocked storage only means writing it again next time.
  }
}

type Status = "idle" | "writing" | "done" | "error";

// Hands the browser a file to save. The link is added and removed at once;
// the object URL outlives the click just long enough for the save to start.
function saveFile(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BUTTON =
  "h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function CoverLetter({ job }: { job: JobDetail }) {
  const { resumeText, userInfo, hasResume } = useResume();
  // Rendered in the browser only, after the posting has loaded.
  const [initial] = useState(() => readSaved(job.jobId));
  const [text, setText] = useState(initial?.text ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [status, setStatus] = useState<Status>(initial?.text ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  if (!hasResume || !resumeText) {
    return (
      <div className="rounded-[10px] bg-surface px-5 py-6 space-y-1.5">
        <p className="text-[14px] font-semibold text-ink">Add your resume to write a cover letter</p>
        <p className="text-[13px] text-slate">
          The letter is written from your resume and this posting, so it needs your resume first — use Add resume in the
          header.
        </p>
      </div>
    );
  }

  const write = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("writing");
    setError(null);
    setText("");
    let letter = "";
    try {
      const res = await fetch(`/api/jobs/${job.jobId}/cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          program: userInfo?.program || null,
          termNumber: userInfo?.coopTermNumber || null,
          note: note.trim() || null,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `The server answered ${res.status}.`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        letter += decoder.decode(value, { stream: true });
        setText(letter);
      }
      letter = letter.trim();
      if (!letter) throw new Error("The letter came back empty. Try again.");
      setText(letter);
      setStatus("done");
      save(job.jobId, { text: letter, note, at: new Date().toISOString() });
    } catch (e) {
      if (controller.signal.aborted) {
        // Stopped by the student: keep what was written so far.
        setStatus(letter.trim() ? "done" : "idle");
        if (letter.trim()) save(job.jobId, { text: letter.trim(), note, at: new Date().toISOString() });
        return;
      }
      setStatus(letter.trim() ? "done" : "error");
      setError(e instanceof Error ? e.message : "Couldn't write the letter.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy — select the text and copy it yourself.");
    }
  };

  // The PDF and Word libraries are only fetched the first time a file is asked for.
  const download = async (kind: "pdf" | "docx") => {
    setExporting(kind);
    setError(null);
    try {
      const { buildLetterPdf, buildLetterDocx, letterFileName } = await import("@/lib/cover-letter-export");
      const title = `Cover letter — ${job.title}, ${job.organization}`;
      const name = letterFileName(job, kind);
      if (kind === "pdf") {
        const font = await fetch("/fonts/Tinos-Regular.ttf").then((r) => {
          if (!r.ok) throw new Error("the letter font didn't load");
          return r.arrayBuffer();
        });
        const bytes = await buildLetterPdf(text, font, title);
        saveFile(new Blob([bytes as BlobPart], { type: "application/pdf" }), name);
      } else {
        const { Packer } = await import("docx");
        saveFile(await Packer.toBlob(buildLetterDocx(text, title)), name);
      }
      save(job.jobId, { text, note, at: new Date().toISOString() });
    } catch (e) {
      setError(`Couldn't make the ${kind === "pdf" ? "PDF" : "Word file"}${e instanceof Error ? `: ${e.message}` : ""}.`);
    } finally {
      setExporting(null);
    }
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const writing = status === "writing";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="cover-note" className="text-[12.5px] font-medium text-charcoal">
          Anything to emphasize? <span className="font-normal text-stone">(optional)</span>
        </label>
        <input
          id="cover-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          disabled={writing}
          placeholder="e.g. my robotics project, or that I can start in January"
          className="w-full h-9 px-3 rounded-lg border border-hairline bg-canvas text-[13px] text-ink placeholder:text-stone focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {writing ? (
          <button onClick={() => abortRef.current?.abort()} className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}>
            Stop
          </button>
        ) : (
          <button onClick={write} className={`${BUTTON} bg-primary text-on-primary hover:bg-primary-pressed`}>
            <SparklesIcon className="w-3.5 h-3.5" />
            {text ? "Write it again" : "Write cover letter"}
          </button>
        )}
        {text && !writing && (
          <>
            <button onClick={copy} className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}>
              <CopyIcon />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => download("pdf")}
              disabled={exporting !== null}
              className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}
            >
              <DownloadIcon />
              {exporting === "pdf" ? "Making PDF…" : "PDF"}
            </button>
            <button
              onClick={() => download("docx")}
              disabled={exporting !== null}
              className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}
            >
              <DownloadIcon />
              {exporting === "docx" ? "Making Word file…" : "Word"}
            </button>
          </>
        )}
        {writing && <span className="text-[12.5px] text-stone animate-pulse">Writing from your resume…</span>}
        {words > 0 && !writing && <span className="text-[12px] text-stone tabular-nums ml-auto">{words} words</span>}
      </div>

      {error && <p className="text-[12.5px] text-poor bg-error/10 px-3 py-2 rounded-lg">{error}</p>}

      {text ? (
        <>
          <textarea
            aria-label="Cover letter"
            value={text}
            readOnly={writing}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => save(job.jobId, { text, note, at: new Date().toISOString() })}
            rows={20}
            className="w-full px-4 py-3.5 rounded-[10px] border border-hairline bg-canvas text-[13.5px] leading-relaxed text-ink resize-y focus:outline-none focus:border-primary"
          />
          <p className="text-[12px] text-stone">
            A draft from your resume — read it through and make it sound like you before you send it. Your edits are kept
            in this browser.
          </p>
        </>
      ) : (
        !writing && (
          <p className="text-[13px] text-slate max-w-[60ch]">
            Drafts a letter for {job.title} at {job.organization} from your resume: the experiences that fit what this job
            asks for, in your own words to edit. It only uses what your resume says.
          </p>
        )
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3.5 h-3.5">
      <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
    </svg>
  );
}
