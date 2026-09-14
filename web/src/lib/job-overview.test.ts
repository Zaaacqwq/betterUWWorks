import { describe, expect, it } from "vitest";
import { buildOverview, composeAddress, type OverviewSource } from "./job-overview";

const job = (overrides: Partial<OverviewSource> = {}): OverviewSource => ({
  level: "Junior, Intermediate",
  jobType: "Co-op Main",
  openings: 2,
  totalHires: 21,
  workTerm: "2027 - Winter",
  workTermDuration: "4 month work term",
  deadline: "Sep 17, 2026 9:00 AM",
  location: "Toronto",
  region: "ON - Toronto",
  locationArrangement: "Hybrid",
  jobSummary: "Help the audit team.",
  jobResponsibilities: "- Test controls\n- Write reports",
  requiredSkills: "Excel",
  compensation: "$25/hr",
  applicationInfo: "Apply early.",
  serviceTeam: null,
  rawDetail: {
    "Job Title": "Audit Co-op",
    Organization: "KPMG",
    "Job Summary": "Help the audit team.",
    "Job - Address Line One": "333 Bay St",
    "Job - Address Line Two": "Suite 4600",
    "Job - City": "Toronto",
    "Job - Province/State": "Ontario",
    "Job - Postal/Zip Code": "M5H 2S5",
    "Job - Country": "Canada",
    "Application Method": "Through WaterlooWorks",
    "Application Documents Required": "Resume\nCover Letter",
    "Transportation and Housing": "Near Union Station",
    "Special Job Requirements": "Must be eligible for CPA",
    "Additional Information": "Bring a laptop",
    "Employer Internal Job Number": "REQ-123",
    "About Us": "We are a firm.",
    _workTermRatings: { anything: true },
  },
  ...overrides,
});

const groupOf = (id: string, o = buildOverview(job())) => o.groups.find((g) => g.id === id);
const labels = (id: string, o = buildOverview(job())) => groupOf(id, o)?.rows.map((r) => r.label);

describe("buildOverview", () => {
  it("puts the address together as one entry in the location group", () => {
    const address = groupOf("location")?.rows.find((r) => r.label === "Address");
    expect(address).toMatchObject({ multiline: true, value: "333 Bay St, Suite 4600\nToronto, Ontario M5H 2S5\nCanada" });
    expect(labels("location")).toEqual(["Work mode", "Address", "Region", "Getting there"]);
  });

  it("falls back to the city when the posting gives no address", () => {
    const o = buildOverview(job({ rawDetail: {} }));
    expect(labels("location", o)).toEqual(["Work mode", "City", "Region"]);
  });

  it("gathers how to apply in one place", () => {
    expect(labels("apply")).toEqual(["Method", "Documents", "Notes", "Employer's ref."]);
  });

  it("marks the deadline with how far away it is and its colour", () => {
    const o = buildOverview(job(), { away: "3 days away", valueClass: "text-poor font-medium" });
    expect(groupOf("term", o)?.rows.find((r) => r.label === "Apply by")).toMatchObject({
      value: "Sep 17, 2026 9:00 AM · 3 days away",
      valueClass: "text-poor font-medium",
    });
  });

  it("keeps special requirements and additional information apart", () => {
    expect(buildOverview(job()).sections.map((s) => s.title)).toEqual([
      "Job summary",
      "Responsibilities",
      "Required skills",
      "Special requirements",
      "Compensation and benefits",
      "Additional information",
    ]);
  });

  it("leaves only the employer's own extra headings for More, nothing already shown", () => {
    expect(buildOverview(job()).more).toEqual([{ title: "About Us", content: "We are a firm." }]);
  });

  it("says each thing once when the posting repeats it across fields", () => {
    const o = buildOverview(
      job({
        rawDetail: {
          "Job Location (If Exact Address Unknown or Multiple Locations)": "Ottawa and Kanata Offices",
          "Additional Employment Arrangement Location Information": "Ottawa and  Kanata offices",
        },
      })
    );
    expect(labels("location", o)).toEqual(["Work mode", "City", "Region", "Where"]);
  });

  it("puts spaces back into the comma-joined document list", () => {
    const o = buildOverview(job({ rawDetail: { "Application Documents Required": "Work History,Résumé,Grade Report" } }));
    expect(groupOf("apply", o)?.rows.find((r) => r.label === "Documents")?.value).toBe("Work History, Résumé, Grade Report");
  });

  it("drops a group with nothing in it", () => {
    const o = buildOverview(job({ level: null, jobType: null, openings: null, totalHires: null }));
    expect(o.groups.map((g) => g.id)).not.toContain("role");
  });

  it("ignores WaterlooWorks' placeholder for the targeted degrees", () => {
    const o = buildOverview(job({ rawDetail: { "Targeted Degrees and Disciplines": "View Targeted Degrees and Disciplines" } }));
    expect(labels("role", o)).not.toContain("For");
    expect(o.more).toEqual([]);
  });
});

describe("composeAddress", () => {
  it("uses whichever parts there are", () => {
    expect(composeAddress({ city: "Waterloo", country: "Canada" })).toBe("Waterloo\nCanada");
    expect(composeAddress({})).toBeNull();
  });
});
