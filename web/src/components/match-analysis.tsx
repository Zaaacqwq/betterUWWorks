"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useResume } from "@/hooks/use-resume";

interface MatchAnalysisProps {
  jobId: string;
}

export function MatchAnalysis({ jobId }: MatchAnalysisProps) {
  const { profile, hasProfile } = useResume();
  const [state, setState] = useState<"idle" | "loading" | "streaming" | "done" | "error">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const prevJobId = useRef(jobId);

  useEffect(() => {
    if (prevJobId.current !== jobId) {
      prevJobId.current = jobId;
      setState("idle");
      setText("");
      setError("");
      abortRef.current?.abort();
    }
  }, [jobId]);

  const generate = useCallback(async () => {
    if (!profile) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    setText("");
    setError("");

    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setState("streaming");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setText(accumulated);
      }

      setState("done");
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to analyze match");
      setState("error");
    }
  }, [jobId, profile]);

  if (!hasProfile) return null;

  if (state === "idle") {
    return (
      <button
        onClick={generate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-brand-orange/30 text-brand-orange text-sm font-medium hover:bg-brand-orange/5 transition-colors"
      >
        <TargetIcon />
        AI Match Analysis
      </button>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 p-4">
        <p className="text-xs text-error">{error}</p>
        <button onClick={generate} className="mt-2 text-xs text-link-blue hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-orange/15 bg-brand-orange/[0.03] p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <TargetIcon />
        <span className="text-[11px] font-semibold text-brand-orange uppercase tracking-wider">
          Match Analysis
        </span>
        {(state === "loading" || state === "streaming") && (
          <span className="text-[11px] text-stone ml-auto">
            {state === "loading" ? (
              <span className="animate-pulse">Analyzing...</span>
            ) : (
              <span className="inline-block w-1.5 h-1.5 bg-brand-orange rounded-full animate-pulse" />
            )}
          </span>
        )}
      </div>
      {text ? (
        <div className="text-sm text-charcoal leading-relaxed">
          <FormattedText text={text} />
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="h-3 bg-brand-orange/10 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-brand-orange/10 rounded w-1/2 animate-pulse" />
        </div>
      )}
    </div>
  );
}

function TargetIcon() {
  return (
    <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <circle cx="12" cy="12" r="6" strokeWidth={2} />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\*\*[^*]+\*\*/.test(line)) {
      const match = line.match(/^\*\*([^*]+)\*\*:?\s*(.*)/);
      if (match) {
        elements.push(
          <h4 key={i} className="font-semibold text-ink mt-3 mb-1 first:mt-0">
            {match[1]}
          </h4>
        );
        if (match[2]?.trim()) {
          elements.push(<p key={`${i}p`} className="text-sm text-charcoal">{match[2]}</p>);
        }
        i++;
        continue;
      }
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("• "))) {
        items.push(<li key={i}>{lines[i].slice(2)}</li>);
        i++;
      }
      elements.push(
        <ul key={`ul${i}`} className="list-disc list-inside space-y-0.5 text-sm text-charcoal">{items}</ul>
      );
      continue;
    }

    if (line.trim() === "") { i++; continue; }

    elements.push(<p key={i} className="text-sm text-charcoal">{line}</p>);
    i++;
  }

  return <>{elements}</>;
}
