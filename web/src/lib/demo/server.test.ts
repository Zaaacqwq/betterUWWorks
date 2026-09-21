import { describe, expect, it } from "vitest";
import { demoAnswer } from "./server";
import { DEMO_POSTINGS } from "./data/postings";

// The demo answers for the server, so what it gives back has to be shaped the
// way the pages already read: an envelope with success, the list's meta, and a
// refusal where the real server would refuse.

async function body(path: string, init?: RequestInit) {
  const res = await demoAnswer(path, init);
  return { status: res.status, json: await res.json() };
}

describe("the demo's answers", () => {
  it("lets the viewer in without signing in, but not as the owner", async () => {
    const { json } = await body("/api/me");
    expect(json.data.status).toBe("approved");
    expect(json.data.isAdmin).toBe(false);
  });

  it("lists every posting with the meta the list pages by", async () => {
    const { json } = await body("/api/jobs?limit=9999");
    expect(json.data).toHaveLength(DEMO_POSTINGS.length);
    expect(json.meta.total).toBe(DEMO_POSTINGS.length);
    expect(json.data[0]).toHaveProperty("parsedHourlyMin");
  });

  it("searches the postings by word", async () => {
    const { json } = await body("/api/jobs?q=firmware&limit=9999");
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data.every((job: { title: string }) => /firmware|embedded/i.test(job.title))).toBe(true);
  });

  it("filters by work mode and by pay", async () => {
    const remote = await body("/api/jobs?arrangement=Remote&limit=9999");
    expect(remote.json.data.every((j: { locationArrangement: string }) => j.locationArrangement === "Remote")).toBe(true);

    const paid = await body("/api/jobs?minPay=35&limit=9999");
    expect(paid.json.data.every((j: { parsedHourlyMax: number }) => j.parsedHourlyMax >= 35)).toBe(true);
  });

  it("gives a posting, and says so when there isn't one", async () => {
    const found = await body(`/api/jobs/${DEMO_POSTINGS[0].jobId}`);
    expect(found.json.data.title).toBe(DEMO_POSTINGS[0].title);

    const missing = await body("/api/jobs/000000");
    expect(missing.status).toBe(404);
    expect(missing.json.success).toBe(false);
  });

  it("checks a posting line by line, and cites the resume for what it found", async () => {
    const checked = DEMO_POSTINGS.find((p) => p.lines)!;
    const { json } = await body(`/api/match/${checked.jobId}`);
    expect(json.data.status).toBe("checked");
    expect(json.data.lines.length).toBe(checked.lines!.length);
    expect(json.data.lines.some((l: { evidence: string | null }) => l.evidence)).toBe(true);
    expect(json.data.skills).toBeGreaterThan(0);
    expect(json.data.skills).toBeLessThanOrEqual(70);
  });

  it("leaves an unchecked posting to its estimate", async () => {
    const unchecked = DEMO_POSTINGS.find((p) => !p.lines)!;
    const detail = await body(`/api/match/${unchecked.jobId}`);
    expect(detail.json.data.status).toBe("unavailable");

    const scores = await body("/api/match/scores");
    expect(scores.json.data.scores[unchecked.jobId]).toBeUndefined();
    expect(scores.json.data.checked).toBe(DEMO_POSTINGS.filter((p) => p.lines).length);
  });

  it("hands over the sample resume so the postings can be scored", async () => {
    const { json } = await body("/api/resume");
    expect(json.data.active.text).toContain("Computer Engineering");
    expect(json.data.resumes).toHaveLength(1);
  });

  it("refuses what would change the real site", async () => {
    const cleared = await body("/api/jobs", { method: "DELETE" });
    expect(cleared.status).toBe(403);

    const parsed = await body("/api/resume/parse", { method: "POST" });
    expect(parsed.status).toBe(403);
    expect(parsed.json.error).toMatch(/sign in/i);
  });

  it("writes the cover letter out as a stream, as the model does", async () => {
    const posting = DEMO_POSTINGS[0];
    const res = await demoAnswer(`/api/jobs/${posting.jobId}/cover-letter`, { method: "POST" });
    expect(res.body).not.toBeNull();
    expect(await res.text()).toBe(posting.letter);
  });

  it("says plainly when it has nothing at a path", async () => {
    const { status, json } = await body("/api/admin/users");
    expect(status).toBe(404);
    expect(json.error).toContain("/api/admin/users");
  });
});
