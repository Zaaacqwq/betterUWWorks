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
    expect(address).toMatchObject({ multiline: true, size: "md", value: "333 Bay St, Suite 4600\nToronto, Ontario M5H 2S5\nCanada" });
    expect(labels("location")).toEqual(["Work mode", "Region", "Address", "Getting there"]);
  });

  it("links a street address to Google Maps", () => {
    const address = groupOf("location")?.rows.find((r) => r.label === "Address");
    expect(address?.href).toBe(
      "https://www.google.com/maps/search/?api=1&query=333%20Bay%20St%2C%20Suite%204600%2C%20Toronto%2C%20Ontario%20M5H%202S5%2C%20Canada"
    );
  });

  it("doesn't link an address with no street — a province is no place to go", () => {
    const o = buildOverview(job({ rawDetail: { "Job - Province/State": "Ontario", "Job - Country": "Canada" } }));
    const address = groupOf("location", o)?.rows.find((r) => r.label === "Address");
    expect(address?.value).toBe("Ontario\nCanada");
    expect(address?.href).toBeUndefined();
  });

  it("falls back to the city when the posting gives no address", () => {
    const o = buildOverview(job({ rawDetail: {} }));
    expect(labels("location", o)).toEqual(["Work mode", "Region", "City"]);
  });

  it("drops a location note that only restates the street address", () => {
    const o = buildOverview(
      job({
        rawDetail: {
          "Job - Address Line One": "1717 Dundas Street",
          "Job - City": "Woodstock",
          "Additional Employment Arrangement Location Information": "Woodstock Location: 1717 Dundas Street, Woodstock, ON N4S 7V9",
        },
      })
    );
    expect(labels("location", o)).toEqual(["Work mode", "Region", "Address"]);
  });

  it("gathers how to apply in one place", () => {
    expect(labels("apply")).toEqual(["Method", "Documents", "Employer's ref.", "Notes"]);
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
    expect(labels("location", o)).toEqual(["Work mode", "Region", "City", "Where"]);
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
