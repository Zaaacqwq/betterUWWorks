import { generateText } from "ai";
import { models } from "@/lib/ai/provider";
import { RESUME_EXTRACT_SYSTEM, resumeExtractPrompt } from "@/lib/ai/prompts";
import type { Capability, EvidenceType, ResumeProfile, Skill } from "@/lib/resume/types";

const VALID_EVIDENCE_TYPES = new Set<EvidenceType>(["work_used", "project_used", "explicit", "inferred", "weak_inferred"]);

function parseCapability(raw: Record<string, unknown>): Capability | null {
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
  };
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
    system: RESUME_EXTRACT_SYSTEM,
    prompt: resumeExtractPrompt(text.slice(0, 30000)),
  });

  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let profile: ResumeProfile;
  try {
    const parsed = JSON.parse(cleaned);

    const rawCaps = Array.isArray(parsed.capabilities) ? parsed.capabilities : [];
    const capabilities = rawCaps
      .map((c: Record<string, unknown>) => parseCapability(c))
      .filter((c: Capability | null): c is Capability => c !== null);

    const skills = capabilities.length > 0
      ? capabilitiesToSkills(capabilities)
      : (Array.isArray(parsed.skills) ? parsed.skills : []);

    profile = {
      capabilities,
      skills,
      profileSchema: 2,
      education: Array.isArray(parsed.education) ? parsed.education : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      coopTermCount: typeof parsed.coopTermCount === "number" ? parsed.coopTermCount : 0,
      programs: Array.isArray(parsed.programs) ? parsed.programs : [],
      preferredLocations: Array.isArray(parsed.preferredLocations) ? parsed.preferredLocations : [],
      preferredArrangement: parsed.preferredArrangement ?? null,
      preferredDuration: parsed.preferredDuration ?? null,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      extractedAt: new Date().toISOString(),
    };
  } catch {
    return Response.json(
      { success: false, error: "Failed to parse AI response. Please try again." },
      { status: 422 }
    );
  }

  return Response.json({ success: true, data: profile });
}
