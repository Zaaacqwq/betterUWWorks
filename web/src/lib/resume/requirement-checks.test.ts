import { describe, expect, it } from "vitest";
import { PROGRAM_POINTS, programFit, requirementWarnings } from "./requirement-checks";
import type { PostingDetails, Requirement } from "@/lib/job-details/types";
import type { UserInfo } from "./types";

const user: UserInfo = { coopTermNumber: 2, gpa: 3.2, yearLevel: 2, program: "Mechanical Engineering" };

const req = (kind: Requirement["kind"], extra: Partial<Requirement> = {}): Requirement => ({
  kind,
  summary: kind,
  value: null,
  required: true,
  quote: "",
  ...extra,
});

const details = (...requirements: Requirement[]): PostingDetails => ({ pay: null, requirements });

describe("requirementWarnings", () => {
  it("warns about a GPA, work term or year the student hasn't reached", () => {
    const warnings = requirementWarnings(
      user,
      details(req("gpa", { value: 3.5 }), req("min_work_term", { value: 3 }), req("min_year", { value: 3 }))
    );
    expect(warnings.map((w) => w.type)).toEqual(["gpa", "coop_term", "year_level"]);
  });

  it("stays quiet when the student meets them", () => {
    expect(
      requirementWarnings(user, details(req("gpa", { value: 3.0 }), req("min_work_term", { value: 2 })))
    ).toEqual([]);
  });

  it("does not compare a 4-point GPA with a percentage average", () => {
    expect(requirementWarnings(user, details(req("gpa", { value: 80 })))).toEqual([]);
  });

  it("does not warn about something the posting only prefers", () => {
    expect(requirementWarnings(user, details(req("gpa", { value: 3.5, required: false })))).toEqual([]);
  });

  it("warns about citizenship or a licence only when the student has said they lack it", () => {
    const posting = details(
      req("citizenship", { summary: "Canadian citizen or PR" }),
      req("drivers_licence", { summary: "Driver's licence" })
    );
    expect(requirementWarnings(user, posting)).toEqual([]);
    expect(
      requirementWarnings({ ...user, citizenOrPermanentResident: false, hasDriversLicence: false }, posting)
    ).toEqual([
      { type: "citizenship", message: "Canadian citizen or PR" },
      { type: "drivers_licence", message: "Driver's licence" },
    ]);
  });

  it("says nothing before the posting's details have been read", () => {
    expect(requirementWarnings(user, null)).toEqual([]);
  });
});

describe("programFit", () => {
  const program = (quote: string, required = true) => details(req("program", { quote, required }));

  it("gives full points when the posting restricts nothing", () => {
    expect(programFit(user, details()).score).toBe(PROGRAM_POINTS.max);
  });

  it("gives full points when the student's program is named", () => {
    expect(programFit(user, program("Open to Mechanical or Mechatronics Engineering students.")).score).toBe(
      PROGRAM_POINTS.max
    );
  });

  it("treats Engineering on its own as open to every engineering program", () => {
    expect(programFit(user, program("Currently enrolled in an Engineering program.")).score).toBe(PROGRAM_POINTS.max);
  });

  it.each([
    "Open to Electrical or Computer Engineering students.",
    "Open only to students in Industrial and Systems Engineering.",
    "Students in Mining or Nuclear Engineering.",
    "Enrolled in Engineering Physics.",
  ])("does not treat a named engineering program as open to all of them: %s", (quote) => {
    expect(programFit(user, program(quote)).score).toBe(PROGRAM_POINTS.restrictedElsewhere);
  });

  it.each([
    "Engineering students in any discipline.",
    "Pursuing a degree in Computer Science or Engineering.",
    "Enrolled in the Faculty of Engineering.",
  ])("treats a general mention of Engineering as open to every engineering program: %s", (quote) => {
    expect(programFit(user, program(quote)).score).toBe(PROGRAM_POINTS.max);
  });

  it("matches an abbreviation only as a whole word", () => {
    const se = { ...user, program: "Software Engineering" };
    expect(programFit(se, program("Students in SE or CS")).debug.matched).toBe(true);
    expect(programFit(se, program("Students doing research in Physics")).debug.matched).toBe(false);
  });

  it("is softer when the program is only preferred", () => {
    expect(programFit(user, program("Physics students preferred.", false)).score).toBe(PROGRAM_POINTS.preferredElsewhere);
  });

  it("is neutral without the student's program or the posting's details", () => {
    expect(programFit(null, program("x")).score).toBe(PROGRAM_POINTS.unknown);
    expect(programFit(user, null).score).toBe(PROGRAM_POINTS.unknown);
  });
});
