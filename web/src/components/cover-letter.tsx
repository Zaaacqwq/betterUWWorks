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
          <button onClick={copy} className={`${BUTTON} border border-hairline text-charcoal hover:bg-surface`}>
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
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
