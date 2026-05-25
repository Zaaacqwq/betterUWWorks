"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import { JobCard } from "./job-card";
import { JobDetailPanel } from "./job-detail-panel";
import { useSavedJobs } from "@/hooks/use-saved-jobs";
import { useResume } from "@/hooks/use-resume";
import { useMatchScores } from "@/hooks/use-match-scores";
import { ResumeUpload } from "./resume-upload";
import type { JobSummary, Filters } from "./types/job";

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

const DEFAULT_FILTERS: Filters = {
  location: "",
  level: "",
  arrangement: "",
  duration: "",
  workTerm: "",
  jobType: "",
  minPay: "",
  minRating: "",
  sort: "deadline",
  order: "desc",
};

const PAGE_SIZE = 20;

function nullsLastCompare(a: number | null, b: number | null, dir: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir * (a - b);
}

export function JobListPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [totalFromServer, setTotalFromServer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    locations: [], levels: [], arrangements: [], durations: [], workTerms: [], jobTypes: [],
  });

  const { savedIds, toggle: toggleSave, isSaved, count: savedCount } = useSavedJobs();
  const { profile, hasResume, userInfo, extraSkills } = useResume();
  const { scores } = useMatchScores(profile, userInfo, jobs, extraSkills);
  const [resumeOpen, setResumeOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/jobs/filters")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setFilterOptions({
          ...data.data,
          levels: [
            { label: "Junior", value: "Junior" },
            { label: "Intermediate", value: "Intermediate" },
            { label: "Senior", value: "Senior" },
          ],
        });
      });
  }, []);

  const fetchJobs = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filters.location) params.set("location", filters.location);
    if (filters.level) params.set("level", filters.level);
    if (filters.arrangement) params.set("arrangement", filters.arrangement);
    if (filters.duration) params.set("duration", filters.duration);
    if (filters.workTerm) params.set("workTerm", filters.workTerm);
    if (filters.jobType) params.set("jobType", filters.jobType);
    if (filters.minPay) params.set("minPay", filters.minPay);
    if (filters.minRating) params.set("minRating", filters.minRating);
    params.set("page", "1");
    params.set("limit", "9999");

    fetch(`/api/jobs?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setJobs(data.data);
          setTotalFromServer(data.meta.total);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") throw e;
      })
      .finally(() => setLoading(false));
  }, [query, filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Sync selectedJobId to URL query param
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedJobId) {
      url.searchParams.set("job", selectedJobId);
    } else {
      url.searchParams.delete("job");
    }
    window.history.replaceState({}, "", url.toString());
  }, [selectedJobId]);

  // Restore from URL on mount
  useEffect(() => {
    const jobFromUrl = new URLSearchParams(window.location.search).get("job");
    if (jobFromUrl) setSelectedJobId(jobFromUrl);
  }, []);

  const handleSelectJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setMobileDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedJobId(null);
    setMobileDetailOpen(false);
  }, []);

  const handleQueryChange = useCallback((v: string) => {
    setQuery(v);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const activeFilterCount = Object.entries(filters).filter(
    ([k, v]) => v !== "" && k !== "sort" && k !== "order"
  ).length + (query ? 1 : 0);

  const handleClearAll = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
    setPage(1);
  }, []);

  const sortedJobs = useMemo(() => {
    const filtered = showSavedOnly ? jobs.filter((j) => savedIds.includes(j.jobId)) : jobs;
    const dir = filters.order === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      switch (filters.sort) {
        case "match":
          return nullsLastCompare(scores[a.jobId]?.score ?? null, scores[b.jobId]?.score ?? null, dir);
        case "pay":
          return nullsLastCompare(a.parsedHourlyMin, b.parsedHourlyMin, dir);
        case "rating":
          return nullsLastCompare(a.employerRating, b.employerRating, dir);
        case "hires":
          return nullsLastCompare(a.totalHires, b.totalHires, dir);
        case "title":
          return dir * (a.title.localeCompare(b.title));
        case "deadline":
        default: {
          const da = a.deadline ?? "";
          const db = b.deadline ?? "";
          return dir * da.localeCompare(db);
        }
      }
    });
  }, [showSavedOnly, jobs, savedIds, filters.sort, filters.order, scores]);

  const totalPages = Math.ceil(sortedJobs.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginatedJobs = sortedJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === "Escape" && selectedJobId) {
        handleCloseDetail();
        return;
      }

      if ((e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") && paginatedJobs.length > 0) {
        e.preventDefault();
        const currentIndex = paginatedJobs.findIndex((j) => j.jobId === selectedJobId);
        const direction = e.key === "ArrowDown" || e.key === "j" ? 1 : -1;
        const nextIndex = currentIndex === -1
          ? 0
          : Math.max(0, Math.min(paginatedJobs.length - 1, currentIndex + direction));
        const nextJob = paginatedJobs[nextIndex];
        setSelectedJobId(nextJob.jobId);
        setMobileDetailOpen(true);

        const card = listRef.current?.querySelector(`[data-job-id="${nextJob.jobId}"]`);
        card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paginatedJobs, selectedJobId, handleCloseDetail]);

  return (
    <div className="h-screen flex flex-col bg-surface-soft">
      {/* Header */}
      <header className="bg-brand-navy shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary text-sm font-bold shrink-0">
              B
            </div>
            <h1 className="text-base font-semibold text-white tracking-tight">
              betterUWWorks
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setResumeOpen(true)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                hasResume
                  ? "bg-brand-green/80 text-white"
                  : "bg-white/10 text-white/70 hover:text-white hover:bg-white/15"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Resume
            </button>
            <button
              onClick={() => setShowSavedOnly((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                showSavedOnly
                  ? "bg-primary text-on-primary"
                  : "bg-white/10 text-white/70 hover:text-white hover:bg-white/15"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill={showSavedOnly ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Saved{savedCount > 0 ? ` (${savedCount})` : ""}
            </button>
            <button
              onClick={fetchJobs}
              className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4.929 9A8 8 0 0119.07 9M19.071 15A8 8 0 014.93 15" />
              </svg>
            </button>
            <p className="text-xs text-stone">
              {totalFromServer} jobs
            </p>
          </div>
        </div>
      </header>

      {/* Split panel body */}
      <div className="flex-1 flex min-h-0 max-w-[1400px] w-full mx-auto">
        {/* Left panel: list */}
        <div
          className={`flex flex-col w-full lg:w-[480px] xl:w-[520px] lg:shrink-0 lg:border-r lg:border-hairline bg-surface-soft ${
            mobileDetailOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="px-5 pt-4 pb-3 space-y-3 shrink-0">
            <SearchBar value={query} onChange={handleQueryChange} />
            <FilterBar
              filters={filters}
              options={filterOptions}
              onChange={handleFilterChange}
              total={totalFromServer}
              activeFilterCount={activeFilterCount}
              onClearAll={handleClearAll}
            />
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-5 pb-4">
            {loading ? (
              <div className="text-center py-16 text-stone">Loading jobs...</div>
            ) : sortedJobs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-stone text-lg">
                  {showSavedOnly ? "No saved jobs" : "No jobs found"}
                </p>
                <p className="text-muted text-sm mt-1">
                  {showSavedOnly
                    ? "Save jobs from the detail panel to see them here"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {paginatedJobs.map((job) => (
                  <div key={job.jobId} data-job-id={job.jobId}>
                    <JobCard
                      job={job}
                      active={job.jobId === selectedJobId}
                      saved={isSaved(job.jobId)}
                      matchScore={scores[job.jobId]}
                      onClick={handleSelectJob}
                    />
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4 pb-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-hairline bg-canvas text-charcoal hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate px-3">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-hairline bg-canvas text-charcoal hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right panel: detail */}
        <div
          className={`flex-1 bg-canvas overflow-hidden ${
            mobileDetailOpen ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          {/* Mobile back button */}
          {mobileDetailOpen && (
            <div className="lg:hidden px-4 py-2.5 border-b border-hairline bg-canvas shrink-0">
              <button
                onClick={() => setMobileDetailOpen(false)}
                className="flex items-center gap-1.5 text-sm text-link-blue font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to list
              </button>
            </div>
          )}
          <JobDetailPanel
            jobId={selectedJobId}
            saved={selectedJobId ? isSaved(selectedJobId) : false}
            onToggleSave={toggleSave}
            onClose={handleCloseDetail}
          />
        </div>
      </div>

      <ResumeUpload open={resumeOpen} onClose={() => setResumeOpen(false)} />
    </div>
  );
}
