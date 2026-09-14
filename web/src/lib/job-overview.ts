// Sorts a posting's fields into the groups the overview shows. WaterlooWorks
// hands over a flat bag of fields — the address alone arrives as six ("Job -
// Address Line One", "Job - City", …) — and listing them in arrival order
// read as one long jumble. Everything here is plain data; the overview only
// renders it.

export interface OverviewRow {
  label: string;
  value: string;
  /** Keep the posting's own line breaks (an address, a list of documents). */
  multiline?: boolean;
  /** Extra classes for the value, e.g. the deadline's urgency colour. */
  valueClass?: string;
  /**
   * How much of the group's grid it takes: a short fact one cell, a longer
   * one (an address, a deadline with its countdown) two, prose the whole row.
   * Every group shares one grid, so columns line up down the page.
   */
  size: "sm" | "md" | "lg";
  /** Opens elsewhere when clicked — the address on a map. */
  href?: string;
}

export interface OverviewGroup {
  id: "role" | "term" | "location" | "apply";
  title: string;
  rows: OverviewRow[];
}

export interface OverviewSection {
  title: string;
  content: string;
}

export interface Overview {
  groups: OverviewGroup[];
  /** The posting's prose, in reading order. */
  sections: OverviewSection[];
  /** Whatever else the employer wrote, under their own headings. */
  more: OverviewSection[];
}

/** The parts of a posting the overview reads; JobDetail satisfies it. */
export interface OverviewSource {
  level: string | null;
  jobType: string | null;
  openings: number | null;
  totalHires: number | null;
  workTerm: string | null;
  workTermDuration: string | null;
  deadline: string | null;
  location: string | null;
  region: string | null;
  locationArrangement: string | null;
  jobSummary: string | null;
  jobResponsibilities: string | null;
  requiredSkills: string | null;
  compensation: string | null;
  applicationInfo: string | null;
  serviceTeam: string | null;
  rawDetail: Record<string, unknown> | null;
}

export interface DeadlineNote {
  /** e.g. "4 days away"; omitted once closed. */
  away?: string;
  valueClass?: string;
}

// Fields shown elsewhere in the detail view, or that say nothing useful.
const SHOWN_ELSEWHERE = ["job title", "organization", "division"];

const ADDRESS_PARTS = {
  line1: "job - address line one",
  line2: "job - address line two",
  city: "job - city",
  province: "job - province/state",
  postal: "job - postal/zip code",
  country: "job - country",
} as const;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// Reads the posting's raw fields by name, however they are capitalised, and
// remembers which ones it has used so the rest can go under "More".
function fieldReader(raw: Record<string, unknown> | null) {
  const byName = new Map<string, { key: string; value: string }>();
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (key.startsWith("_")) continue;
    const v = text(value);
    if (v) byName.set(key.trim().toLowerCase(), { key, value: v });
  }
  const used = new Set<string>(SHOWN_ELSEWHERE);
  return {
    get(name: string): string | null {
      used.add(name);
      return byName.get(name)?.value ?? null;
    },
    /** Marks fields as covered by a value taken from elsewhere (the job's own columns). */
    cover(...names: string[]) {
      names.forEach((n) => used.add(n));
    },
    rest(): OverviewSection[] {
      return [...byName.entries()]
        .filter(([name]) => !used.has(name))
        .map(([, { key, value }]) => ({ title: key, content: value }));
    },
  };
}

// "123 King St W, Suite 4 / Toronto, ON M5V 1A1 / Canada", from whichever
// parts the posting gave.
export function composeAddress(parts: Partial<Record<keyof typeof ADDRESS_PARTS, string | null>>): string | null {
  const street = [parts.line1, parts.line2].filter(Boolean).join(", ");
  const cityLine = [[parts.city, parts.province].filter(Boolean).join(", "), parts.postal].filter(Boolean).join(" ");
  const lines = [street, cityLine, parts.country].filter((l): l is string => Boolean(l));
  return lines.length ? lines.join("\n") : null;
}

function row(label: string, value: string | number | null | undefined, extra: Partial<OverviewRow> = {}): OverviewRow[] {
  if (value == null || value === "") return [];
  return [{ label, value: String(value), size: "sm", ...extra }];
}

// A street address is worth a map; "Ontario, Canada" is not.
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\n/g, ", "))}`;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

// A location note that restates the street address ("Woodstock Location: 1717
// Dundas Street, …") says nothing the address row doesn't.
function restatesStreet(note: string | null, street: string | null): string | null {
  if (!note) return null;
  return street && squash(note).includes(squash(street)) ? null : note;
}

// Postings often repeat themselves across fields ("Where" and "Arrangement"
// both "Ottawa and Kanata Offices"); a group says each thing once.
function distinct(rows: OverviewRow[]): OverviewRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = r.value.replace(/\s+/g, " ").trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// "Work History,Résumé,Grade Report" — WaterlooWorks joins lists without spaces.
function spaceCommas(value: string | null): string | null {
  return value ? value.replace(/,(?=\S)/g, ", ") : value;
}

export function buildOverview(job: OverviewSource, deadline: DeadlineNote = {}): Overview {
  const f = fieldReader(job.rawDetail);
  // Columns the import already read out of these fields (lib/extract-detail.ts).
  f.cover(
    "level", "job type", "number of job openings", "work term", "work term duration", "region",
    "employment location arrangement", "location/work arrangement", "job summary", "job responsibilities",
    "required skills", "compensation and benefits", "compensation and benefits information",
    "additional application information", "application information", "service team"
  );

  const degrees = f.get("targeted degrees and disciplines");
  const role: OverviewGroup = {
    id: "role",
    title: "The role",
    rows: [
      ...row("Level", job.level),
      ...row("Job type", job.jobType),
      ...row("Openings", job.openings),
      ...row("Past hires", job.totalHires ? `${job.totalHires} over the past 9 terms` : null),
      // WaterlooWorks sometimes leaves only its link text here.
      ...row("For", degrees && !/^view targeted degrees/i.test(degrees) ? degrees : null, { multiline: true, size: "lg" }),
    ],
  };

  const term: OverviewGroup = {
    id: "term",
    title: "Term & deadline",
    rows: [
      ...row("Work term", job.workTerm),
      ...row("Duration", job.workTermDuration),
      ...row("Apply by", job.deadline ? (deadline.away ? `${job.deadline} · ${deadline.away}` : job.deadline) : null, {
        valueClass: deadline.valueClass,
        size: "md",
      }),
      ...row("Start & end", f.get("special work term start/end date considerations"), { multiline: true, size: "lg" }),
    ],
  };

  const parts = Object.fromEntries(Object.entries(ADDRESS_PARTS).map(([part, name]) => [part, f.get(name)]));
  const address = composeAddress(parts);
  const street = parts.line1 ?? null;
  const location: OverviewGroup = {
    id: "location",
    title: "Location",
    rows: [
      ...row("Work mode", job.locationArrangement),
      ...row("Region", job.region),
      // The city is part of the address when there is one.
      ...(address
        ? row("Address", address, { multiline: true, size: "md", href: street ? mapsUrl(address) : undefined })
        : row("City", job.location)),
      ...row("Where", restatesStreet(f.get("job location (if exact address unknown or multiple locations)"), street), {
        multiline: true,
        size: "lg",
      }),
      ...row("Arrangement", restatesStreet(f.get("additional employment arrangement location information"), street), {
        multiline: true,
        size: "lg",
      }),
      ...row("Getting there", f.get("transportation and housing"), { multiline: true, size: "lg" }),
    ],
  };

  const apply: OverviewGroup = {
    id: "apply",
    title: "How to apply",
    rows: [
      ...row("Method", f.get("application method") ?? f.get("application delivery"), { multiline: true }),
      ...row("Documents", spaceCommas(f.get("application documents required")), { multiline: true, size: "md" }),
      ...row("Employer's ref.", f.get("employer internal job number")),
      ...row("Website", f.get("if by website, go to"), { size: "md" }),
      ...row("Other IDs", f.get("additional job identifiers"), { multiline: true, size: "md" }),
      ...row("Service team", job.serviceTeam),
      ...row("Notes", job.applicationInfo, { multiline: true, size: "lg" }),
    ],
  };

  const sections: OverviewSection[] = [
    { title: "Job summary", content: job.jobSummary },
    { title: "Responsibilities", content: job.jobResponsibilities },
    { title: "Required skills", content: job.requiredSkills },
    // Read from the posting directly: the import folds both into one column.
    { title: "Special requirements", content: f.get("special job requirements") },
    { title: "Compensation and benefits", content: job.compensation },
    { title: "Additional information", content: f.get("additional information") },
  ].filter((s): s is OverviewSection => Boolean(s.content));

  return {
    groups: [role, term, location, apply]
      .map((g) => ({ ...g, rows: distinct(g.rows) }))
      .filter((g) => g.rows.length > 0),
    sections,
    more: f.rest(),
  };
}
