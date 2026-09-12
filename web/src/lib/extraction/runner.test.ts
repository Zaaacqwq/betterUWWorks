import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

vi.mock("@/db", () => ({ db: {} }));

const { jobs } = await import("@/db/schema");
const { pendingWhere, runPending } = await import("./runner");

function render(selection: Parameters<typeof pendingWhere>[1]) {
  const where = pendingWhere(jobs.aiDetailsAt, selection);
  if (!where) throw new Error("expected a condition");
  return new PgDialect().sqlToQuery(where);
}

describe("pendingWhere", () => {
  it("by default selects postings with a detail that were never read", () => {
    const { sql } = render({});
    expect(sql).toContain('"jobs"."raw_detail" is not null');
    expect(sql).toContain('"jobs"."ai_details_at" is null');
    expect(sql).not.toContain("<");
  });

  it("with olderThan also selects postings read before the cut-off", () => {
    const cutoff = new Date("2026-09-10T00:00:00Z");
    const { sql, params } = render({ olderThan: cutoff });
    expect(sql).toContain('"jobs"."ai_details_at" < $1');
    expect(params).toEqual([cutoff.toISOString()]);
  });

  it("leaves out postings resting after a failure", () => {
    const where = pendingWhere(jobs.aiDetailsAt, {}, ["x"]);
    const { sql, params } = new PgDialect().sqlToQuery(where!);
    expect(sql).toContain('"jobs"."job_id" not in ($1)');
    expect(params).toEqual(["x"]);
  });

  it("limits the selection to the given postings", () => {
    const { sql, params } = render({ jobIds: ["a", "b"] });
    expect(sql).toContain('"jobs"."job_id" in ($1, $2)');
    expect(params).toEqual(["a", "b"]);
  });
});

describe("runPending", () => {
  const postings = [{ jobId: "1" }, { jobId: "2" }, { jobId: "3" }];
  let process: ReturnType<typeof vi.fn>;

  function extractor(name: string) {
    return {
      name,
      doneAt: jobs.aiDetailsAt,
      concurrency: 2,
      load: async () => postings,
      process,
    };
  }

  beforeEach(() => {
    process = vi.fn();
  });

  it("reads every pending posting and reports failures without stopping", async () => {
    process.mockImplementation(async (p: { jobId: string }) => {
      if (p.jobId === "2") throw new Error("gateway down");
    });
    const run = await runPending(extractor("a"), 10);
    expect(run).toEqual({ processed: 2, skipped: 0, failures: [{ jobId: "2", reason: "gateway down" }] });
  });

  it("leaves postings another run is already reading to that run", async () => {
    const waiting: (() => void)[] = [];
    process.mockImplementation(() => new Promise<void>((resolve) => waiting.push(resolve)));
    const first = runPending(extractor("b"), 10);
    await new Promise((r) => setTimeout(r, 0));

    const second = await runPending(extractor("b"), 10);
    expect(second).toEqual({ processed: 0, skipped: 3, failures: [] });

    process.mockImplementation(async () => {});
    waiting.forEach((resolve) => resolve());
    expect(await first).toEqual({ processed: 3, skipped: 0, failures: [] });
  });
});
