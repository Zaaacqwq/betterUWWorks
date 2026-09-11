// What the model reads when listing a posting's skills. Every word it may cite
// has to come from here: the same text is what its citations are checked
// against, so anything left out can be neither found nor verified.

export interface SkillSourceSection {
  label: string;
  text: string;
}

// Fields that describe the posting's logistics rather than the work. Left in,
// they only give the model places to find names that are not skills — a city,
// an application portal, a benefits provider.
const LOGISTICS_KEYS = new Set([
  "job title",
  "organization",
  "division",
  "level",
  "number of job openings",
  "work term",
  "job type",
  "region",
  "work term duration",
  "targeted degrees and disciplines",
  "compensation and benefits",
  "compensation and benefits information",
  "application method",
  "application delivery",
  "application documents required",
  "additional application information",
  "application information",
  "employment location arrangement",
  "location/work arrangement",
  "additional employment arrangement location information",
  "special work term start/end date considerations",
  "transportation and housing",
  "employer internal job number",
  "additional job identifiers",
  "service team",
]);

function isLogisticsKey(key: string): boolean {
  const lower = key.toLowerCase().trim();
  return LOGISTICS_KEYS.has(lower) || lower.startsWith("job - ") || lower.startsWith("job location");
}

function collectStrings(detail: Record<string, unknown>, out: SkillSourceSection[]): void {
  for (const [key, value] of Object.entries(detail)) {
    if (key === "_sections" && value && typeof value === "object") {
      for (const section of Object.values(value as Record<string, unknown>)) {
        if (section && typeof section === "object") {
          collectStrings(section as Record<string, unknown>, out);
        }
      }
      continue;
    }
    if (key.startsWith("_") || isLogisticsKey(key)) continue;
    if (typeof value !== "string") continue;

    const text = value.trim();
    if (text && !out.some((s) => s.text === text)) {
      out.push({ label: key.trim(), text });
    }
  }
}

export function buildSkillSource(job: { title: string; rawDetail: unknown }): SkillSourceSection[] {
  const sections: SkillSourceSection[] = [{ label: "Job Title", text: job.title.trim() }];
  if (job.rawDetail && typeof job.rawDetail === "object") {
    collectStrings(job.rawDetail as Record<string, unknown>, sections);
  }
  return sections;
}

// A title alone is not enough to go on: asked about one, the model invents the
// skills such a job usually needs, which is exactly what must never happen.
export function hasSkillSource(sections: SkillSourceSection[]): boolean {
  return sections.length > 1;
}

export function renderSkillSource(sections: SkillSourceSection[]): string {
  return sections.map((s) => `${s.label}:\n${s.text}`).join("\n\n");
}
