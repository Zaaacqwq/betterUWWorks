import { after } from "next/server";
import { z } from "zod/v4";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lineGrades } from "@/db/schema";
import { recheckAffected } from "@/lib/line-check/affected";
import { forget, kick } from "@/lib/line-check/grader";
import { noOwner, resumeOwnerOf } from "@/lib/line-check/owner";
import {
  addResume,
  deleteAllResumes,
  listResumes,
  saveResume,
  TooManyResumes,
  type ResumeInput,
} from "@/lib/line-check/store";

// The student's resumes. One is in use: it is what the site scores against and
// what the background checking works through; the rest keep the checks made
// while they were in use, so going back to one is instant.

const MAX_PROFILE_CHARS = 300_000;

const bodySchema = z.object({
  text: z.string().trim().min(50).max(50_000),
  fileName: z.string().max(300).nullish(),
  label: z.string().trim().max(80).nullish(),
  profile: z.record(z.string(), z.unknown()).nullish(),
  userInfo: z.record(z.string(), z.unknown()).nullish(),
  extraSkills: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
  skillLevels: z.record(z.string().max(100), z.enum(["proficient", "familiar", "none"])).default({}),
});

function inputOf(data: z.infer<typeof bodySchema>): ResumeInput {
  return {
    text: data.text,
    fileName: data.fileName ?? null,
    label: data.label ?? null,
    profile: data.profile ?? null,
    userInfo: data.userInfo ?? null,
    extraSkills: data.extraSkills,
    skillLevels: data.skillLevels,
  };
}

async function body(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return { error: Response.json({ success: false, error: "That resume couldn't be saved: it's empty or too long." }, { status: 400 }) };
  }
  if (JSON.stringify(parsed.data.profile ?? null).length > MAX_PROFILE_CHARS) {
    return { error: Response.json({ success: false, error: "That resume's profile is too large to save." }, { status: 413 }) };
  }
  return { data: parsed.data };
}

export interface ResumeSummary {
  id: string;
  label: string | null;
  fileName: string | null;
  active: boolean;
  version: number;
  updatedAt: string;
  // Postings checked against it so far.
  checked: number;
}

export async function GET(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const [held, counts] = await Promise.all([
    listResumes(email),
    db
      .select({ resumeId: lineGrades.resumeId, checked: sql<number>`count(*)::int` })
      .from(lineGrades)
      .where(eq(lineGrades.email, email))
      .groupBy(lineGrades.resumeId),
  ]);
  const checkedBy = new Map(counts.map((c) => [c.resumeId, c.checked]));
  const active = held.find((r) => r.active) ?? null;

  return Response.json({
    success: true,
    data: {
      active: active && {
        id: active.id,
        label: active.label,
        text: active.text,
        fileName: active.fileName,
        profile: active.profile,
        userInfo: active.userInfo,
        extraSkills: active.extraSkills,
        skillLevels: active.skillLevels,
        version: active.version,
        updatedAt: active.updatedAt,
      },
      resumes: held.map(
        (r): ResumeSummary => ({
          id: r.id,
          label: r.label,
          fileName: r.fileName,
          active: r.active,
          version: r.version,
          updatedAt: r.updatedAt.toISOString(),
          checked: checkedBy.get(r.id) ?? 0,
        })
      ),
    },
  });
}

/** Saves over the resume in use — its text, or the details and skills around it. */
export async function PUT(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const { data, error } = await body(request);
  if (error) return error;

  const { resume, change } = await saveResume(email, inputOf(data));
  if (change.kind === "new-version") kick(email);
  if (change.kind === "skills") {
    after(() => recheckAffected(resume, change).catch((err) => console.error("[line-check] recheck failed:", err)));
  }
  return Response.json({
    success: true,
    data: { id: resume.id, version: resume.version, change: change.kind, updatedAt: resume.updatedAt },
  });
}

/** Keeps another resume alongside the others and puts it in use. */
export async function POST(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const { data, error } = await body(request);
  if (error) return error;

  try {
    const resume = await addResume(email, inputOf(data));
    kick(email);
    return Response.json({
      success: true,
      data: { id: resume.id, version: resume.version, change: "new-version", updatedAt: resume.updatedAt },
    });
  } catch (err) {
    if (err instanceof TooManyResumes) return Response.json({ success: false, error: err.message }, { status: 409 });
    throw err;
  }
}

// Removes every resume this student has, and every check made against them.
export async function DELETE(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  await deleteAllResumes(email);
  forget(email);
  return Response.json({ success: true });
}
