import type { Me } from "@/app/api/me/route";
import type { ExtractionStatus } from "@/app/api/jobs/extraction-status/route";
import type { RequirementKind } from "@/lib/job-details/types";
import { skillsScore, toCheck, toDetail, toSummary, type SamplePosting } from "./data/posting";
import { DEMO_POSTINGS } from "./data/postings";
import { DEMO_PROFILE, DEMO_RESUME_FILE, DEMO_RESUME_ID, DEMO_RESUME_TEXT, DEMO_USER_INFO } from "./data/resume";

// The demo's own little server, answering in the browser what the real one
// answers over the network (src/app/api). It gives back ordinary Responses, so
// every caller reads them exactly as it reads the real thing — including the
// cover letter, which arrives as a stream there and here.

// Whoever is looking at the demo: let in, but not the owner, so nothing that
// changes the real site appears in the menu.
const DEMO_VIEWER: Me = {
  signedIn: true,
  email: null,
  name: "Demo",
  image: null,
  status: "approved",
  isAdmin: false,
};

// The demo resume, and the edits made to it while the tab is open. Nothing here
// outlives the visit — there is no server to keep it.
const resume = {
  id: DEMO_RESUME_ID,
  text: DEMO_RESUME_TEXT,
  fileName: DEMO_RESUME_FILE as string | null,
  profile: DEMO_PROFILE as unknown,
  userInfo: DEMO_USER_INFO as unknown,
  extraSkills: [] as string[],
  skillLevels: {} as Record<string, string>,
  version: 1,
  updatedAt: "2026-08-30T15:20:00.000Z",
};

const ok = (data: unknown, extra: Record<string, unknown> = {}) =>
  Response.json({ success: true, data, ...extra });
const no = (error: string, status = 400) => Response.json({ success: false, error }, { status });

// Only the path and query of a call matter here; the host never does, and a
// fixed one keeps this readable away from a browser.
const BASE = "http://demo.invalid";

export async function demoAnswer(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, BASE);
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname;

  if (path === "/api/me") return ok(DEMO_VIEWER);
  // Only the reading half: deleting the postings is the owner's, and the demo
  // has no owner.
  if (path === "/api/jobs") return method === "GET" ? jobsList(url) : no("The demo can't change the postings.", 403);
  if (path === "/api/jobs/filters") return ok(filterOptions());
  if (path === "/api/jobs/extraction-status") return ok(extractionStatus());
  if (path === "/api/match/scores") return ok(lineScores());
  if (path === "/api/resume") return resumeLibrary(method, init);
  if (path.startsWith("/api/resume/")) return resumeEdit(path, method);

  const match = path.match(/^\/api\/match\/([^/]+)$/);
  if (match) return jobCheck(match[1]);

  const job = path.match(/^\/api\/jobs\/([^/]+)(\/[a-z-]+)?$/);
  if (job) return jobRoute(job[1], job[2] ?? "", method, init);

  return no(`The demo has nothing at ${path}.`, 404);
}

function find(jobId: string): SamplePosting | undefined {
  return DEMO_POSTINGS.find((p) => p.jobId === jobId);
}

function jobRoute(jobId: string, sub: string, method: string, init?: RequestInit): Promise<Response> | Response {
  const posting = find(jobId);
  if (!posting) return no("That posting isn't in the demo.", 404);
  if (sub === "") return ok(toDetail(posting));
  if (sub === "/summary") return ok({ summary: posting.summary });
  if (sub === "/match" && method === "POST") return ok(posting.advice);
  if (sub === "/cover-letter" && method === "POST") return letter(posting, init);
  return no(`The demo has nothing at /api/jobs/${jobId}${sub}.`, 404);
}

// --- The list ---------------------------------------------------------------

function jobsList(url: URL): Response {
  const p = url.searchParams;
  const rows = DEMO_POSTINGS.filter((posting) => keeps(posting, p)).map((posting) => toSummary(posting));
  const limit = Math.max(1, parseInt(p.get("limit") ?? "20", 10));
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10));
  const start = (page - 1) * limit;
  return ok(rows.slice(start, start + limit), {
    meta: {
      total: rows.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(rows.length / limit)),
      // Nothing was ever brought over: the list says so in its own words.
      syncedAt: null,
    },
  });
}

// The same filters the real /api/jobs applies, over eight postings instead of
// a term's worth.
function keeps(posting: SamplePosting, p: URLSearchParams): boolean {
  const q = p.get("q")?.trim().toLowerCase();
  if (q) {
    const haystack = [posting.title, posting.organization, posting.summary, ...posting.skills, posting.requiredSkills]
      .join(" ")
      .toLowerCase();
    if (!q.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  if (!matchesAny(p.get("location"), posting.location)) return false;
  if (!matchesAny(p.get("arrangement"), posting.arrangement)) return false;
  if (!matchesAny(p.get("duration"), posting.duration)) return false;
  if (!matchesAny(p.get("workTerm"), posting.workTerm)) return false;
  if (!matchesAny(p.get("jobType"), posting.jobType ?? "Co-op")) return false;
  if (!matchesAny(p.get("level"), posting.level ?? "")) return false;

  const minPay = parseFloat(p.get("minPay") ?? "");
  if (!isNaN(minPay) && (posting.pay?.max ?? posting.pay?.min ?? 0) < minPay) return false;
  const minRating = parseFloat(p.get("minRating") ?? "");
  if (!isNaN(minRating) && (posting.rating?.score ?? -1) < minRating) return false;

  const hidden = (p.get("hideRequirement") ?? "").split(",").filter(Boolean) as RequirementKind[];
  if (hidden.some((kind) => (posting.requirements ?? []).some((r) => r.required && r.kind === kind))) return false;

  return true;
}

function matchesAny(param: string | null, value: string): boolean {
  const wanted = (param ?? "").split(",").filter(Boolean);
  if (wanted.length === 0) return true;
  return wanted.some((w) => value.toLowerCase().includes(w.toLowerCase()));
}

function filterOptions() {
  const count = (of: (posting: SamplePosting) => string | null) => {
    const tally = new Map<string, number>();
    for (const posting of DEMO_POSTINGS) {
      const value = of(posting);
      if (value) tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, n]) => ({ label: `${value} (${n})`, value }));
  };
  return {
    locations: count((p) => p.location),
    levels: count((p) => p.level ?? null),
    arrangements: count((p) => p.arrangement),
    durations: count((p) => p.duration),
    workTerms: count((p) => p.workTerm),
    jobTypes: count((p) => p.jobType ?? "Co-op"),
  };
}

function extractionStatus(): ExtractionStatus {
  const total = DEMO_POSTINGS.length;
  const lines = DEMO_POSTINGS.filter((p) => p.lines).length;
  return {
    total,
    withoutDetail: 0,
    kinds: [
      { kind: "skills", label: "Skills", done: total, waiting: 0, failed: 0 },
      { kind: "details", label: "Pay and requirements", done: total, waiting: 0, failed: 0 },
      { kind: "summary", label: "Summaries", done: total, waiting: 0, failed: 0 },
      { kind: "lines", label: "Lines", done: lines, waiting: total - lines, failed: 0 },
    ],
  };
}

// --- The line-by-line check -------------------------------------------------

function lineScores() {
  const scores: Record<string, number> = {};
  for (const posting of DEMO_POSTINGS) {
    if (posting.lines) scores[posting.jobId] = skillsScore(posting.lines).skills;
  }
  const checked = Object.keys(scores).length;
  return {
    resumeId: resume.id,
    version: resume.version,
    scores,
    total: DEMO_POSTINGS.length,
    checked,
    // The two unchecked postings stay unchecked: there is no model here to
    // check them with, and their estimate is worth showing.
    running: false,
    retrying: 0,
    paused: false,
  };
}

function jobCheck(jobId: string): Response {
  const posting = find(jobId);
  if (!posting) return no("That posting isn't in the demo.", 404);
  return ok(toCheck(posting));
}

// --- The resume -------------------------------------------------------------

function summaryOf() {
  return [
    {
      id: resume.id,
      label: "Sample resume",
      fileName: resume.fileName,
      active: true,
      version: resume.version,
      updatedAt: resume.updatedAt,
      checked: DEMO_POSTINGS.filter((p) => p.lines).length,
    },
  ];
}

async function resumeLibrary(method: string, init?: RequestInit): Promise<Response> {
  if (method === "GET") return ok({ active: { ...resume }, resumes: summaryOf() });
  if (method === "PUT" || method === "POST") {
    // Edits made in the demo — a skill added, details changed — are kept for as
    // long as the tab is open, so the scores move the way they really would.
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    Object.assign(resume, body, { version: resume.version + 1, updatedAt: new Date().toISOString() });
    return ok({ id: resume.id, updatedAt: resume.updatedAt, version: resume.version });
  }
  if (method === "DELETE") return no("The demo keeps its sample resume. Sign in to work with your own.", 403);
  return no(`The demo can't ${method} the resume.`, 405);
}

function resumeEdit(path: string, method: string): Response {
  if (method === "DELETE") return no("The demo keeps its sample resume. Sign in to work with your own.", 403);
  if (path.endsWith("/parse") || path.endsWith("/extract")) {
    return no("The demo reads its sample resume only. Sign in to have your own read.", 403);
  }
  return ok({ id: resume.id, updatedAt: resume.updatedAt, version: resume.version });
}

// --- The cover letter -------------------------------------------------------

// Written out a few words at a time, because the real one is written by a model
// as you watch and the waiting is part of what the demo is showing. A whole
// letter takes about two seconds, which is roughly what the model takes.
const LETTER_CHUNK_MS = 40;
const WORDS_PER_CHUNK = 4;

function letter(posting: SamplePosting, init?: RequestInit): Response {
  const words = posting.letter.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(""));
  }
  const signal = init?.signal;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        if (signal?.aborted) break;
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, LETTER_CHUNK_MS));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
