"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchBar } from "./search-bar";
import { FilterBar } from "./filter-bar";
import { JobCard } from "./job-card";
import { JobDetailPanel } from "./job-detail-panel";
import { useSavedJobs } from "@/hooks/use-saved-jobs";
import { useHiddenJobs } from "@/hooks/use-hidden-jobs";
import { syncResumeWithServer, useResume } from "@/hooks/use-resume";
import { useMatchScores } from "@/hooks/use-match-scores";
import { useLineScores } from "@/hooks/use-line-scores";
import { ResumeUpload } from "./resume-upload";
import { CheckProgress } from "./check-progress";
import { Pagination } from "./pagination";
import { AppHeader, type ClearState } from "./app-header";
import { AccessGate } from "./access-gate";
import { OnboardingTour } from "./onboarding-tour";
import { useViewer } from "@/hooks/use-viewer";
import { ChevronLeftIcon } from "./icons";
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
  hideRequirement: "",
  closed: "",
  sort: "match",
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
  const [loading, setLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  // Turned-down postings are out of the list until the student asks for them.
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [clearState, setClearState] = useState<ClearState>("idle");
  // Rows in the table regardless of search and filters: the list header shows
  // "n of total", and Clear has to name the whole table's count to the server.
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const [clearError, setClearError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    locations: [], levels: [], arrangements: [], durations: [], workTerms: [], jobTypes: [],
  });

  // Nothing is asked for until the viewer has been let in: the server would
  // refuse it, and the access card covers the list meanwhile.
  const viewer = useViewer();
  const canLoad = viewer.status === "approved";

  const { savedIds, toggle: toggleSave, isSaved, count: savedCount } = useSavedJobs();
  const { hiddenIds, toggle: toggleHidden, isHidden, count: hiddenCount } = useHiddenJobs();
  const { profile, hasResume, userInfo, extraSkills, skillLevels } = useResume();
  // Checked line by line on the server; until a posting is, its score is the
  // name-matching estimate worked out here.
  const lineScores = useLineScores(canLoad && profile != null);
  const { scores } = useMatchScores(profile, userInfo, jobs, extraSkills, skillLevels, lineScores?.scores);
  const [resumeOpen, setResumeOpen] = useState(false);
  // Bumped by "Take the tour" in the header menu.
  const [tourRequest, setTourRequest] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (canLoad) void syncResumeWithServer();
  }, [canLoad]);

  useEffect(() => {
    if (!canLoad) return;
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
  }, [canLoad]);

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
    if (filters.hideRequirement) params.set("hideRequirement", filters.hideRequirement);
    if (filters.closed) params.set("closed", filters.closed);
    params.set("page", "1");
    params.set("limit", "9999");

    fetch(`/api/jobs?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setJobs(data.data);
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") throw e;
      })
      .finally(() => setLoading(false));
  }, [query, filters]);

  useEffect(() => {
    if (canLoad) fetchJobs();
  }, [fetchJobs, canLoad]);

  const fetchCatalogTotal = useCallback(() => {
    fetch("/api/jobs?limit=1")
      .then((r) => r.json())
      .then((data) => setCatalogTotal(data.success ? data.meta.total : null))
      // Unknown total: the list shows its own count and delete stays off
      // until a refresh succeeds, since the server needs the exact number.
      .catch(() => setCatalogTotal(null));
  }, []);

  useEffect(() => {
    if (canLoad) fetchCatalogTotal();
  }, [fetchCatalogTotal, canLoad]);

  const handleRefresh = useCallback(() => {
    fetchJobs();
    fetchCatalogTotal();
  }, [fetchJobs, fetchCatalogTotal]);

  // Two-step so a stray click cannot wipe a scrape; the count goes along so the
  // server refuses if the table changed since this page loaded.
  const clearAllJobs = useCallback(async () => {
    if (clearState === "idle") {
      setClearError(null);
      setClearState("confirming");
      return;
    }
    if (clearState !== "confirming") return;

    setClearState("clearing");
    try {
      // The server checks the whole table, closed postings included, while the
      // list only counts what it shows.
      const all = await fetch("/api/jobs?limit=1&closed=1").then((r) => r.json());
      const resp = await fetch(`/api/jobs?expected=${all?.meta?.total ?? -1}`, { method: "DELETE" });
      const result = await resp.json();
      if (!resp.ok || !result.success) {
        setClearError(result.error || resp.statusText);
        return;
      }
      setSelectedJobId(null);
      handleRefresh();
    } catch (err) {
      setClearError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      setClearState("idle");
    }
  }, [clearState, handleRefresh]);

  const cancelClear = useCallback(() => {
    setClearState((s) => (s === "confirming" ? "idle" : s));
  }, []);

  // Restore from URL on mount. This has to run before the sync below, whose
  // first pass sees no selection yet and strips ?job= from the URL.
  useEffect(() => {
    const jobFromUrl = new URLSearchParams(window.location.search).get("job");
    if (jobFromUrl) setSelectedJobId(jobFromUrl);
  }, []);

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
    setFilters((prev) => ({ ...DEFAULT_FILTERS, sort: prev.sort, order: prev.order }));
    setQuery("");
    setSearchKey((k) => k + 1);
    setPage(1);
  }, []);

  const sortedJobs = useMemo(() => {
    const filtered = showHiddenOnly
      ? jobs.filter((j) => hiddenIds.includes(j.jobId))
      : (showSavedOnly ? jobs.filter((j) => savedIds.includes(j.jobId)) : jobs).filter(
          (j) => !hiddenIds.includes(j.jobId)
        );
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
  }, [showSavedOnly, showHiddenOnly, jobs, savedIds, hiddenIds, filters.sort, filters.order, scores]);

  const totalPages = Math.ceil(sortedJobs.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const paginatedJobs = sortedJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [page]);

  // The tour points at a posting's detail pane, so it needs one open.
  const openFirstJob = useCallback(() => {
    if (!selectedJobId && paginatedJobs[0]) setSelectedJobId(paginatedJobs[0].jobId);
  }, [selectedJobId, paginatedJobs]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (resumeOpen) return;
      // The tour's own arrow keys and Esc step through it; the list waits.
      if (document.body.classList.contains("driver-active")) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if (e.key === "Escape" && selectedJobId) {
        handleCloseDetail();
        return;
      }

      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && paginatedJobs.length > 0) {
        e.preventDefault();
        const currentIndex = paginatedJobs.findIndex((j) => j.jobId === selectedJobId);
        const direction = e.key === "ArrowDown" ? 1 : -1;
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
  }, [paginatedJobs, selectedJobId, handleCloseDetail, resumeOpen]);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <AppHeader
        savedCount={savedCount}
        hiddenCount={hiddenCount}
        showHiddenOnly={showHiddenOnly}
        onToggleHiddenOnly={() => {
          setShowHiddenOnly((v) => !v);
          setShowSavedOnly(false);
          setPage(1);
        }}
        showSavedOnly={showSavedOnly}
        onToggleSaved={() => {
          setShowSavedOnly((v) => !v);
          setShowHiddenOnly(false);
          setPage(1);
        }}
        hasResume={hasResume}
        onOpenResume={() => setResumeOpen(true)}
        onRefresh={handleRefresh}
        catalogTotal={catalogTotal}
        clearState={clearState}
        clearError={clearError}
        onClearAll={clearAllJobs}
        onCancelClear={cancelClear}
        onStartTour={() => setTourRequest((n) => n + 1)}
      />

      {/* Split panel body */}
      <div className="flex-1 flex min-h-0 w-full">
        {/* Left panel: list */}
        <div
          className={`flex flex-col w-full lg:w-[452px] xl:w-[480px] lg:shrink-0 lg:border-r lg:border-hairline bg-surface ${
            mobileDetailOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="px-4 pt-4 pb-2.5 space-y-2.5 shrink-0">
            <SearchBar key={searchKey} value={query} onChange={handleQueryChange} />
            <FilterBar
              filters={filters}
              options={filterOptions}
              onChange={handleFilterChange}
              activeFilterCount={activeFilterCount}
              onClearAll={handleClearAll}
              shownCount={sortedJobs.length}
              catalogTotal={catalogTotal}
              loading={loading}
            />
            {profile && lineScores && <CheckProgress progress={lineScores} />}
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-4">
            {loading ? (
              <ListSkeleton />
            ) : catalogTotal === 0 ? (
              <EmptyState
                title="No jobs yet"
                body="Open WaterlooWorks with the betterUWWorks extension and scrape a job board. Postings show up here once they're imported."
                action={{ label: "Refresh", onClick: handleRefresh }}
              />
            ) : sortedJobs.length === 0 ? (
              showHiddenOnly ? (
                <EmptyState
                  title="Nothing turned down yet"
                  body="Not interested on a posting takes it out of the list. They gather here."
                  action={{ label: "Show all jobs", onClick: () => setShowHiddenOnly(false) }}
                />
              ) : showSavedOnly && savedCount === 0 ? (
                <EmptyState
                  title="No saved jobs yet"
                  body="Save a job from its detail panel to keep it here."
                  action={{ label: "Show all jobs", onClick: () => setShowSavedOnly(false) }}
                />
              ) : (
                <EmptyState
                  title={showSavedOnly ? "No saved jobs match" : "No jobs match"}
                  body="Nothing fits the current search and filters."
                  action={activeFilterCount > 0 ? { label: "Clear filters", onClick: handleClearAll } : undefined}
                />
              )
            ) : (
              // grid-cols-1 is minmax(0, 1fr). Without it the column widens to a
              // card's longest unwrapped line — a long employer name that is
              // meant to be cut short — and pushes every card past the edge.
              <div className="grid grid-cols-1 gap-2">
                {paginatedJobs.map((job, i) => (
                  <div key={job.jobId} data-job-id={job.jobId} data-tour={i === 0 ? "job-card" : undefined}>
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

            {!loading && totalPages > 1 && (
              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            )}
          </div>
        </div>

        {/* Right panel: detail */}
        <div
          className={`flex-1 min-w-0 bg-canvas overflow-hidden ${
            mobileDetailOpen ? "flex flex-col" : "hidden lg:flex lg:flex-col"
          }`}
        >
          {mobileDetailOpen && (
            <div className="lg:hidden px-3 py-2 border-b border-hairline-soft bg-canvas shrink-0">
              <button
                onClick={() => setMobileDetailOpen(false)}
                className="h-8 flex items-center gap-1 px-1.5 rounded-lg text-[13px] font-medium text-charcoal hover:bg-surface"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                All jobs
              </button>
            </div>
          )}
          <JobDetailPanel
            jobId={selectedJobId}
            saved={selectedJobId ? isSaved(selectedJobId) : false}
            matchScore={selectedJobId ? scores[selectedJobId] : undefined}
            hidden={selectedJobId ? isHidden(selectedJobId) : false}
            onToggleHidden={toggleHidden}
            onToggleSave={toggleSave}
            onClose={handleCloseDetail}
          />
        </div>
      </div>

      <ResumeUpload open={resumeOpen} onClose={() => setResumeOpen(false)} onOpen={() => setResumeOpen(true)} />
      <AccessGate viewer={viewer} />
      <OnboardingTour
        ready={canLoad && !loading && paginatedJobs.length > 0}
        hasResume={profile != null}
        resumeOpen={resumeOpen}
        onOpenResume={() => setResumeOpen(true)}
        onOpenFirstJob={openFirstJob}
        startRequest={tourRequest}
      />
    </div>
  );
}

const PAGE_BUTTON =
  "h-8 px-3 text-[13px] font-medium rounded-lg border border-hairline bg-canvas text-charcoal hover:bg-surface-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16 gap-1.5">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="text-[13px] text-slate max-w-[34ch]">{body}</p>
      {action && (
        <button onClick={action.onClick} className={`${PAGE_BUTTON} mt-3`}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-2 animate-pulse" aria-label="Loading jobs">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-canvas border border-hairline rounded-[10px] px-3.5 py-3 space-y-2">
          <div className="h-3.5 bg-surface rounded w-3/4" />
          <div className="h-3 bg-surface rounded w-1/2" />
          <div className="h-3 bg-surface rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
