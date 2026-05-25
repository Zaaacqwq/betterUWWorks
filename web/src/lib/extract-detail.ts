interface ExtractedFields {
  workTerm: string | null;
  jobType: string | null;
  region: string | null;
  address: string | null;
  locationArrangement: string | null;
  workTermDuration: string | null;
  specialRequirements: string | null;
  jobSummary: string | null;
  jobResponsibilities: string | null;
  requiredSkills: string | null;
  compensation: string | null;
  applicationDelivery: string | null;
  applicationInfo: string | null;
  serviceTeam: string | null;
}

const FIELD_MAP: Record<string, keyof ExtractedFields> = {
  "work term": "workTerm",
  "job type": "jobType",
  "region": "region",
  "job - address line one": "address",
  "employment location arrangement": "locationArrangement",
  "location/work arrangement": "locationArrangement",
  "work term duration": "workTermDuration",
  "special job requirements": "specialRequirements",
  "additional information": "specialRequirements",
  "job summary": "jobSummary",
  "job responsibilities": "jobResponsibilities",
  "required skills": "requiredSkills",
  "compensation and benefits": "compensation",
  "compensation and benefits information": "compensation",
  "application delivery": "applicationDelivery",
  "additional application information": "applicationInfo",
  "application information": "applicationInfo",
  "service team": "serviceTeam",
};

export function extractDetailFields(raw: unknown): ExtractedFields {
  const result: ExtractedFields = {
    workTerm: null,
    jobType: null,
    region: null,
    address: null,
    locationArrangement: null,
    workTermDuration: null,
    specialRequirements: null,
    jobSummary: null,
    jobResponsibilities: null,
    requiredSkills: null,
    compensation: null,
    applicationDelivery: null,
    applicationInfo: null,
    serviceTeam: null,
  };

  if (!raw || typeof raw !== "object") return result;
  const detail = raw as Record<string, unknown>;

  for (const [key, value] of Object.entries(detail)) {
    if (key === "_sections") {
      if (typeof value === "object" && value !== null) {
        for (const sectionValue of Object.values(value as Record<string, unknown>)) {
          if (typeof sectionValue === "object" && sectionValue !== null) {
            matchFields(sectionValue as Record<string, unknown>, result);
          }
        }
      }
      continue;
    }

    const normalizedKey = key.toLowerCase().trim();
    const mappedField = FIELD_MAP[normalizedKey];
    if (mappedField && typeof value === "string" && value.trim()) {
      result[mappedField] = value.trim();
    }
  }

  return result;
}

const SKIP_EXTRA_KEYS = new Set([
  "job title", "organization", "division", "level",
  "number of job openings", "work term", "job type",
  "region", "work term duration", "targeted degrees and disciplines",
]);

export function extractExtraText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const detail = raw as Record<string, unknown>;
  const parts: string[] = [];

  for (const [key, value] of Object.entries(detail)) {
    if (key.startsWith("_")) continue;
    const lower = key.toLowerCase().trim();
    if (FIELD_MAP[lower]) continue;
    if (SKIP_EXTRA_KEYS.has(lower)) continue;
    if (typeof value === "string" && value.trim()) {
      parts.push(value.trim());
    }
  }

  return parts.join("\n");
}

function matchFields(obj: Record<string, unknown>, result: ExtractedFields) {
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_content") continue;
    const normalizedKey = key.toLowerCase().trim();
    const mappedField = FIELD_MAP[normalizedKey];
    if (mappedField && typeof value === "string" && value.trim() && !result[mappedField]) {
      result[mappedField] = value.trim();
    }
  }
}
