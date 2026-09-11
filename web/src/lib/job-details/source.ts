// What the model reads for pay and requirements, and what its quotes are
// checked against. Unlike the skill reading, this keeps compensation, the
// special requirements and the location — the very fields skills leave out —
// and drops only what can hold neither: addresses, reference numbers, how to apply.

const IRRELEVANT_KEYS = new Set([
  "job - address line one",
  "job - address line two",
  "job - postal/zip code",
  "employer internal job number",
  "additional job identifiers",
  "application method",
  "application delivery",
  "application documents required",
  "targeted degrees and disciplines",
  "number of job openings",
  "service team",
]);

export interface DetailSource {
  text: string;
  country: string | null;
}

function stringField(detail: Record<string, unknown>, key: string): string | null {
  const value = detail[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function buildDetailSource(job: { title: string; location: string | null; rawDetail: unknown }): DetailSource | null {
  if (!job.rawDetail || typeof job.rawDetail !== "object") return null;
  const detail = job.rawDetail as Record<string, unknown>;

  const sections: string[] = [`Job Title:\n${job.title.trim()}`];
  const place = [stringField(detail, "Job - City"), stringField(detail, "Job - Province/State"), stringField(detail, "Job - Country")]
    .filter(Boolean)
    .join(", ");
  if (place || job.location) sections.push(`Location:\n${place || job.location}`);

  let hasContent = false;
  for (const [key, value] of Object.entries(detail)) {
    const lower = key.toLowerCase().trim();
    if (key.startsWith("_") || lower.startsWith("job - ") || IRRELEVANT_KEYS.has(lower)) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    sections.push(`${key.trim()}:\n${value.trim()}`);
    hasContent = true;
  }

  // Only a title and a place: nothing to read pay or requirements from.
  if (!hasContent) return null;
  return { text: sections.join("\n\n"), country: stringField(detail, "Job - Country") };
}
