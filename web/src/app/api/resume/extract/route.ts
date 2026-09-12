import { generateText } from "ai";
import { models, FAST_OPTIONS } from "@/lib/ai/provider";
import { RESUME_EXTRACT_SYSTEM, resumeExtractPrompt } from "@/lib/ai/prompts";
import { AiJsonError, parseAiJson } from "@/lib/ai/json";
import type { Capability, EvidenceType, ResumeProfile, Skill } from "@/lib/resume/types";
import { verifiedExperience, verifyCapabilities, type RawCapability } from "@/lib/resume/verify-capabilities";

const VALID_EVIDENCE_TYPES = new Set<EvidenceType>(["work_used", "project_used", "explicit", "inferred", "weak_inferred"]);

function parseCapability(raw: Record<string, unknown>): RawCapability | null {
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;

  const evidenceType = VALID_EVIDENCE_TYPES.has(raw.evidence_type as EvidenceType)
    ? (raw.evidence_type as EvidenceType)
    : "explicit";

  return {
    name: raw.name.trim(),
    category: typeof raw.category === "string" ? (raw.category as Capability["category"]) : "other",
    evidenceSource: typeof raw.evidence_source === "string" ? raw.evidence_source : "Unknown",
    evidenceType,
    confidence: Math.max(0, Math.min(1, typeof raw.confidence === "number" ? raw.confidence : 0.5)),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning : "",
    mention: typeof raw.mention === "string" ? raw.mention : null,
  };
}

// The model is free to answer with a number, an object, or nothing at all for
// these, so keep only an actual string.
function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function capabilitiesToSkills(capabilities: Capability[]): Skill[] {
  const best = new Map<string, Capability>();
  for (const cap of capabilities) {
    const key = cap.name.toLowerCase();
    const existing = best.get(key);
    if (!existing || cap.confidence > existing.confidence) {
      best.set(key, cap);
    }
  }

  return [...best.values()].map((cap) => ({
    name: cap.name,
    category: cap.category,
    proficiency: cap.confidence >= 0.7 ? "advanced" as const : cap.confidence >= 0.4 ? "intermediate" as const : "beginner" as const,
  }));
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = body.text as string | undefined;

  if (!text || text.length < 50) {
    return Response.json(
      { success: false, error: "Resume text too short" },
      { status: 400 }
    );
  }

  if (text.length > 50000) {
    return Response.json(
      { success: false, error: "Resume text too long (max 50,000 chars)" },
      { status: 400 }
    );
  }

  const { text: raw } = await generateText({
    model: models.fast,
    providerOptions: FAST_OPTIONS,
    system: RESUME_EXTRACT_SYSTEM,
    prompt: resumeExtractPrompt(text.slice(0, 30000)),
  });

  let profile: ResumeProfile;
  try {
    const parsed = parseAiJson<Record<string, unknown>>(raw, "resume extraction");

    const rawCaps = Array.isArray(parsed.capabilities) ? parsed.capabilities : [];
    const parsedCaps = rawCaps
      .map((c: Record<string, unknown>) => parseCapability(c))
      .filter((c: RawCapability | null): c is RawCapability => c !== null);
    // Only what the resume shows counts as written on it (verify-capabilities.ts).
    const { capabilities } = verifyCapabilities(parsedCaps, text);

    const skills = capabilities.length > 0
      ? capabilitiesToSkills(capabilities)
      : (Array.isArray(parsed.skills) ? parsed.skills : []);

    profile = {
      capabilities,
      skills,
      profileSchema: 2,
      education: Array.isArray(parsed.education) ? parsed.education : [],
      experience: verifiedExperience(Array.isArray(parsed.experience) ? parsed.experience : [], capabilities),
      coopTermCount: typeof parsed.coopTermCount === "number" ? parsed.coopTermCount : 0,
      programs: Array.isArray(parsed.programs) ? parsed.programs : [],
      preferredLocations: Array.isArray(parsed.preferredLocations) ? parsed.preferredLocations : [],
      preferredArrangement: asText(parsed.preferredArrangement),
      preferredDuration: asText(parsed.preferredDuration),
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      extractedAt: new Date().toISOString(),
    };
  } catch (err) {
    // Say what came back. "Please try again" gave no way to tell a malformed
    // reply from a model that had stopped answering at all.
    const detail = err instanceof AiJsonError ? err.message : "unreadable response";
    return Response.json(
      { success: false, error: `Could not read the AI response (${detail}).` },
      { status: 422 }
    );
  }

  return Response.json({ success: true, data: profile });
}
