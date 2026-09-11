import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/ai/provider", () => ({ models: { fast: "model" }, FAST_OPTIONS: {} }));

const { extractPostingSkills, mergeReadings, READINGS } = await import("./extract");

const posting = {
  jobId: "1",
  title: "Backend Developer",
  rawDetail: {
    "Job Summary": "Build services in Go on Kubernetes with PostgreSQL. The next generation of our platform.",
  },
};

const reply = (entries: { skill: string; mention: string }[]) => ({ text: JSON.stringify(entries) });

// Replies in the order the readings ask, one per call; the last repeats.
function replies(...texts: ({ text: string } | Error)[]) {
  let call = 0;
  generateText.mockImplementation(async () => {
    const next = texts[Math.min(call++, texts.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  });
}

function skillsOf(result: Awaited<ReturnType<typeof extractPostingSkills>>): string[] {
  if (result.kind !== "extracted") throw new Error(`expected an extraction, got ${result.kind}`);
  return result.result.skills;
}

describe("extractPostingSkills", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("asks nothing about a posting that is only a title", async () => {
    const result = await extractPostingSkills({ ...posting, rawDetail: null });
    expect(result).toEqual({ kind: "no-source" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("keeps only the skills the posting names", async () => {
    replies(
      reply([
        { skill: "Go", mention: "Go" },
        { skill: "Kubernetes", mention: "Kubernetes" },
        { skill: "Next.js", mention: "next" },
        { skill: "Docker", mention: "Docker" },
      ])
    );
    expect(skillsOf(await extractPostingSkills(posting))).toEqual(["Go", "Kubernetes"]);
    expect(generateText).toHaveBeenCalledTimes(READINGS);
  });

  it("merges what separate readings found", async () => {
    replies(
      reply([{ skill: "Go", mention: "Go" }]),
      reply([{ skill: "Kubernetes", mention: "Kubernetes" }]),
      reply([{ skill: "PostgreSQL", mention: "PostgreSQL" }, { skill: "Go", mention: "Go" }]),
      reply([])
    );
    expect(skillsOf(await extractPostingSkills(posting))).toEqual(["Go", "Kubernetes", "PostgreSQL"]);
  });

  it("asks a reading again when its reply is not valid JSON", async () => {
    replies({ text: "`` [{“skill”: “Go”}]" }, reply([{ skill: "Go", mention: "Go" }]));
    expect(skillsOf(await extractPostingSkills(posting))).toEqual(["Go"]);
    expect(generateText).toHaveBeenCalledTimes(READINGS + 1);
  });

  it("uses the readings that worked when some fail", async () => {
    replies(new Error("gateway down"), reply([{ skill: "Go", mention: "Go" }]));
    expect(skillsOf(await extractPostingSkills(posting))).toEqual(["Go"]);
  });

  it("fails when no reading works, so the posting is tried again later", async () => {
    replies(new Error("gateway down"));
    await expect(extractPostingSkills(posting)).rejects.toThrow("gateway down");
  });
});

describe("mergeReadings", () => {
  it("puts the skills most readings agree on first, under their commonest name", () => {
    const merged = mergeReadings([
      { skills: ["Postgres", "Go"], verdicts: [] },
      { skills: ["PostgreSQL", "Kubernetes"], verdicts: [] },
      { skills: ["PostgreSQL"], verdicts: [] },
    ]);
    expect(merged.skills).toEqual(["PostgreSQL", "Go", "Kubernetes"]);
  });
});
