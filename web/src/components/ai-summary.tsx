"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AiSummaryProps {
  jobId: string;
}

export function AiSummary({ jobId }: AiSummaryProps) {
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    setText("");
    setError("");

    try {
      const res = await fetch(`/api/jobs/${jobId}/summary`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        const json = await res.json();
        setText(json.data);
        setState("done");
        return;
      }

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
      setError(e instanceof Error ? e.message : "Failed to generate summary");
      setState("error");
    }
  }, [jobId]);

  if (state === "idle") {
    return (
      <button
        onClick={generate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
      >
        <SparklesIcon />
        AI Summary
      </button>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 p-4">
        <p className="text-xs text-error">{error}</p>
        <button
          onClick={generate}
          className="mt-2 text-xs text-link-blue hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <SparklesIcon />
        <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
          AI Summary
        </span>
        {state === "loading" && (
          <span className="text-[11px] text-stone animate-pulse ml-auto">Generating...</span>
        )}
        {state === "streaming" && (
          <span className="text-[11px] text-stone ml-auto">
            <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          </span>
        )}
      </div>
      {text ? (
        <div className="text-sm text-charcoal leading-relaxed prose-sm prose-strong:text-ink prose-ul:my-1 prose-li:my-0">
          <Markdown text={text} />
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="h-3 bg-primary/10 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-primary/10 rounded w-1/2 animate-pulse" />
        </div>
      )}
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("**") && line.endsWith("**") && !line.includes(":**")) {
      elements.push(
        <h4 key={i} className="font-semibold text-ink mt-3 mb-1 first:mt-0">
          {line.replace(/\*\*/g, "")}
        </h4>
      );
      i++;
      continue;
    }

    if (/^\*\*[^*]+\*\*:/.test(line)) {
      const match = line.match(/^\*\*([^*]+)\*\*:\s*(.*)/);
      if (match) {
        elements.push(
          <h4 key={i} className="font-semibold text-ink mt-3 mb-1 first:mt-0">
            {match[1]}
          </h4>
        );
        if (match[2].trim()) {
          elements.push(
            <p key={`${i}p`} className="text-sm text-charcoal">
              <InlineFormat text={match[2]} />
            </p>
          );
        }
        i++;
        continue;
      }
    }

    if (line.startsWith("- ") || line.startsWith("• ")) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("• "))) {
        listItems.push(
          <li key={i}>
            <InlineFormat text={lines[i].slice(2)} />
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul${i}`} className="list-disc list-inside space-y-0.5 text-sm text-charcoal">
          {listItems}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    elements.push(
      <p key={i} className="text-sm text-charcoal">
        <InlineFormat text={line} />
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

function InlineFormat({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
