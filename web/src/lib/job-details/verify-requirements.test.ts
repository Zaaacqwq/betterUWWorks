import { describe, expect, it } from "vitest";
import { verifyRequirements } from "./verify-requirements";

const POSTING = `Special Job Requirements:
Applicants must be Canadian citizens or permanent residents.
Must be legally eligible to work in Canada.
Candidates must obtain Enhanced Reliability security clearance.
Unrestricted Driver Licence. Own Transportation Required.
This work opportunity is based in the USA; therefore all applicants must determine whether they are eligible to work in the USA.
Bilingualism (English and French) is an asset.
Minimum cumulative GPA of 3.0 required.
Must be entering your third work term or higher.
Students are responsible for ensuring they are eligible for an 8-month work term before applying.
Open to students in Mechanical or Mechatronics Engineering.`;

const entry = (kind: string, quote: string, extra: Record<string, unknown> = {}) => ({
  kind,
  summary: kind,
  value: null,
  required: true,
  quote,
  ...extra,
});

describe("verifyRequirements", () => {
  it("keeps each kind of requirement the posting states", () => {
    const { requirements, notes } = verifyRequirements(
      [
        entry("citizenship", "Applicants must be Canadian citizens or permanent residents."),
        entry("security_clearance", "Candidates must obtain Enhanced Reliability security clearance."),
        entry("drivers_licence", "Unrestricted Driver Licence."),
        entry("us_work_authorization", "all applicants must determine whether they are eligible to work in the USA"),
        entry("language", "Bilingualism (English and French) is an asset.", { required: false }),
        entry("gpa", "Minimum cumulative GPA of 3.0 required.", { value: 3 }),
        entry("min_work_term", "Must be entering your third work term or higher.", { value: 3 }),
        entry("consecutive_terms", "Students are responsible for ensuring they are eligible for an 8-month work term before applying."),
        entry("program", "Open to students in Mechanical or Mechatronics Engineering."),
      ],
      POSTING
    );
    expect(notes).toEqual([]);
    expect(requirements.map((r) => r.kind)).toEqual([
      "citizenship",
      "security_clearance",
      "drivers_licence",
      "us_work_authorization",
      "language",
      "gpa",
      "min_work_term",
      "program",
      "consecutive_terms",
    ]);
    expect(requirements.find((r) => r.kind === "language")?.required).toBe(false);
    expect(requirements.find((r) => r.kind === "min_work_term")?.value).toBe(3);
  });

  it("never files being eligible to work in Canada as a citizenship requirement", () => {
    const { requirements } = verifyRequirements(
      [entry("citizenship", "Must be legally eligible to work in Canada.")],
      POSTING
    );
    expect(requirements).toEqual([]);
  });

  it("rejects a requirement quoted from words the posting doesn't contain", () => {
    const { requirements } = verifyRequirements(
      [entry("citizenship", "Applicants must be Canadian citizens.")],
      "Open to all students."
    );
    expect(requirements).toEqual([]);
  });

  it("keeps the requirement but drops a value the sentence doesn't state", () => {
    const { requirements } = verifyRequirements(
      [entry("gpa", "Minimum cumulative GPA of 3.0 required.", { value: 3.5 })],
      POSTING
    );
    expect(requirements).toEqual([expect.objectContaining({ kind: "gpa", value: null, required: true })]);
  });

  it("keeps a requirement whose value was put on the wrong scale", () => {
    const quote = "Minimum cumulative average of 75% is required.";
    const { requirements } = verifyRequirements([entry("gpa", quote, { value: 3 })], quote);
    expect(requirements).toEqual([expect.objectContaining({ kind: "gpa", value: null })]);
  });

  it("rejects an unknown kind and malformed entries", () => {
    const { requirements, notes } = verifyRequirements(
      [entry("vibes", "Unrestricted Driver Licence."), "text", null],
      POSTING
    );
    expect(requirements).toEqual([]);
    expect(notes).toHaveLength(3);
  });

  it("keeps one entry per kind, preferring a required one", () => {
    const { requirements } = verifyRequirements(
      [
        entry("drivers_licence", "Unrestricted Driver Licence.", { required: false }),
        entry("drivers_licence", "Own Transportation Required."),
      ],
      POSTING
    );
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toMatchObject({ quote: "Own Transportation Required.", required: true });
  });

  it("reads years of study written in the plural", () => {
    const { requirements } = verifyRequirements(
      [entry("min_year", "Working towards completing 4th years of undergraduate studies", { value: 4 })],
      "Working towards completing 4th years of undergraduate studies or a master or PhD"
    );
    expect(requirements[0]).toMatchObject({ kind: "min_year", value: 4 });
  });

  it("takes a requirement the sentence only prefers as preferred, whatever the reading said", () => {
    const quote = "8 month consecutive work term preferred";
    const { requirements } = verifyRequirements([entry("consecutive_terms", quote, { required: true })], quote);
    expect(requirements[0].required).toBe(false);
  });

  it("keeps a requirement required when the sentence says so, even beside a preference", () => {
    const quote = "Must be eligible for an 8-month work term; a 12-month term is preferred.";
    const { requirements } = verifyRequirements([entry("consecutive_terms", quote)], quote);
    expect(requirements[0].required).toBe(true);
  });

  it("returns nothing when there are no requirements", () => {
    expect(verifyRequirements([], POSTING).requirements).toEqual([]);
    expect(verifyRequirements(null, POSTING)).toEqual({ requirements: [], notes: [] });
  });
});
