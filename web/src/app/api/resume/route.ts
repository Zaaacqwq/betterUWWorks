import { after } from "next/server";
import { z } from "zod/v4";
import { recheckAffected } from "@/lib/line-check/affected";
import { forget, kick } from "@/lib/line-check/grader";
import { noOwner, resumeOwnerOf } from "@/lib/line-check/owner";
import { deleteResume, getResume, saveResume } from "@/lib/line-check/store";

// The signed-in student's resume, kept on the server so their postings can be
// checked against it while they are away, and so it follows them to another
// browser. The browser keeps its own copy and sends every change here.

const MAX_PROFILE_CHARS = 300_000;

const bodySchema = z.object({
  text: z.string().trim().min(50).max(50_000),
  fileName: z.string().max(300).nullish(),
  profile: z.record(z.string(), z.unknown()).nullish(),
  userInfo: z.record(z.string(), z.unknown()).nullish(),
  extraSkills: z.array(z.string().trim().min(1).max(80)).max(200).default([]),
  skillLevels: z.record(z.string().max(100), z.enum(["proficient", "familiar", "none"])).default({}),
});

export async function GET(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const resume = await getResume(email);
  if (!resume) return Response.json({ success: true, data: null });
  return Response.json({
    success: true,
    data: {
      text: resume.text,
      fileName: resume.fileName,
      profile: resume.profile,
      userInfo: resume.userInfo,
      extraSkills: resume.extraSkills,
      skillLevels: resume.skillLevels,
      version: resume.version,
      updatedAt: resume.updatedAt,
    },
  });
}

export async function PUT(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ success: false, error: "That resume couldn't be saved: it's empty or too long." }, { status: 400 });
  }
  if (JSON.stringify(parsed.data.profile ?? null).length > MAX_PROFILE_CHARS) {
    return Response.json({ success: false, error: "That resume's profile is too large to save." }, { status: 413 });
  }

  const { resume, change } = await saveResume(email, {
    text: parsed.data.text,
    fileName: parsed.data.fileName ?? null,
    profile: parsed.data.profile ?? null,
    userInfo: parsed.data.userInfo ?? null,
    extraSkills: parsed.data.extraSkills,
    skillLevels: parsed.data.skillLevels,
  });

  if (change.kind === "new-version") kick(email);
  if (change.kind === "skills") {
    after(() => recheckAffected(resume, change).catch((err) => console.error("[line-check] recheck failed:", err)));
  }
  return Response.json({ success: true, data: { version: resume.version, change: change.kind, updatedAt: resume.updatedAt } });
}

// Removes the resume and every check made against it.
export async function DELETE(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  await deleteResume(email);
  forget(email);
  return Response.json({ success: true });
}
