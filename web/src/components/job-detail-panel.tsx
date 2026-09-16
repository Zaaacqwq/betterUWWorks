"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchScore } from "@/lib/resume/types";
import type { JobDetail } from "./types/job";
import { JobDetailHeader } from "./job-detail-header";
import { JobDetailOverview } from "./job-detail-overview";
import { JobDetailRatings } from "./job-detail-ratings";
import { JobDetailSkeleton } from "./job-detail-skeleton";
import { MatchBreakdown } from "./match-breakdown";
import { ApplicationAdvice } from "./application-advice";
import { CoverLetter } from "./cover-letter";
import { Kbd } from "./kbd";

type Tab = "overview" | "match" | "ratings" | "cover";

interface JobDetailPanelProps {
  jobId: string | null;
  saved: boolean;
  matchScore?: MatchScore;
  onToggleSave: (jobId: string) => void;
  hidden: boolean;
  onToggleHidden: (jobId: string) => void;
  onClose: () => void;
}

export function JobDetailPanel({ jobId, saved, matchScore, onToggleSave, hidden, onToggleHidden, onClose }: JobDetailPanelProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    setTab("overview");
    setLoading(true);
    const controller = new AbortController();

    fetch(`/api/jobs/${jobId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setJob(data.success ? data.data : null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") throw e;
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [jobId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [jobId, tab]);

  if (!jobId) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full text-center px-8 gap-2">
        <p className="text-sm text-slate">Select a job to see the full posting</p>
        <p className="text-xs text-stone">
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> move through the list · <Kbd>/</Kbd> search · <Kbd>esc</Kbd> close
        </p>
      </div>
    );
  }

  const hasRatings = job?.workTermRatings != null && (
    job.workTermRatings.hiringHistory != null ||
    job.workTermRatings.ratingsSummary != null ||
    job.workTermRatings.hiresByFaculty != null
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    ...(matchScore ? [{ id: "match" as const, label: "Match breakdown" }] : []),
    ...(hasRatings ? [{ id: "ratings" as const, label: "Work term ratings" }] : []),
    { id: "cover", label: "Cover letter" },
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "overview";

  return (
    <div className="flex flex-col h-full">
      {loading ? (
        <JobDetailSkeleton />
      ) : job ? (
        <>
          <JobDetailHeader
            job={job}
            saved={saved}
            matchScore={matchScore}
            onToggleSave={onToggleSave}
            hidden={hidden}
            onToggleHidden={onToggleHidden}
            onClose={onClose}
          />

          <div role="tablist" className="flex gap-5 sm:gap-6 px-5 sm:px-7 mt-4 border-b border-hairline-soft shrink-0 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                data-tour={t.id === "match" ? "match-tab" : t.id === "cover" ? "cover-tab" : undefined}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setTab(t.id)}
                className={`py-2.5 -mb-px border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? "border-ink text-ink"
                    : "border-transparent text-steel hover:text-charcoal"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
            {activeTab === "overview" && <JobDetailOverview job={job} />}
            {activeTab === "match" && matchScore && (
              <div className="space-y-5">
                <MatchBreakdown score={matchScore} jobId={job.jobId} />
                <ApplicationAdvice job={job} />
              </div>
            )}
            {activeTab === "ratings" && <JobDetailRatings ratings={job.workTermRatings!} />}
            {activeTab === "cover" && <CoverLetter key={job.jobId} job={job} />}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-1 text-center px-8">
          <p className="text-sm text-slate">This job isn&apos;t in the database any more</p>
          <p className="text-xs text-stone">It may have been cleared. Refresh the list to see what&apos;s there now.</p>
        </div>
      )}
    </div>
  );
}
