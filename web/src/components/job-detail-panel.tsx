"use client";

import { useEffect, useRef, useState } from "react";
import type { JobDetail } from "./types/job";
import { JobDetailHeader } from "./job-detail-header";
import { JobDetailOverview } from "./job-detail-overview";
import { JobDetailRatings } from "./job-detail-ratings";
import { JobDetailSkeleton } from "./job-detail-skeleton";

interface JobDetailPanelProps {
  jobId: string | null;
  saved: boolean;
  onToggleSave: (jobId: string) => void;
  onClose: () => void;
}

export function JobDetailPanel({ jobId, saved, onToggleSave, onClose }: JobDetailPanelProps) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"overview" | "ratings">("overview");
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
        if (data.success) setJob(data.data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") throw e;
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [jobId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [jobId]);

  if (!jobId) {
    return (
      <div className="hidden lg:flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-stone" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-stone text-sm">Select a job to view details</p>
      </div>
    );
  }

  const hasRatings = job?.workTermRatings != null && (
    job.workTermRatings.hiringHistory != null ||
    job.workTermRatings.ratingsSummary != null ||
    job.workTermRatings.hiresByFaculty != null
  );

  return (
    <div className="flex flex-col h-full">
      {loading ? (
        <JobDetailSkeleton />
      ) : job ? (
        <>
          <JobDetailHeader job={job} saved={saved} onToggleSave={onToggleSave} onClose={onClose} />

          {hasRatings && (
            <div className="flex gap-1 px-6 py-2.5 border-b border-hairline bg-canvas">
              <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
                Overview
              </TabButton>
              <TabButton active={tab === "ratings"} onClick={() => setTab("ratings")}>
                Work Term Ratings
              </TabButton>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
            {tab === "overview" ? (
              <JobDetailOverview job={job} />
            ) : (
              <JobDetailRatings ratings={job.workTermRatings!} />
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-stone text-sm">Job not found</p>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
        active ? "bg-ink-deep text-on-primary" : "text-steel hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
