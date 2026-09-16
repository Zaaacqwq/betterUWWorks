import { z } from "zod/v4";
import { kick } from "@/lib/line-check/grader";
import { noOwner, resumeOwnerOf } from "@/lib/line-check/owner";
import { deleteResume, renameResume, useResume } from "@/lib/line-check/store";

// One of the student's resumes: put it in use, rename it, or remove it.

const patchSchema = z.object({
  use: z.literal(true).optional(),
  label: z.string().trim().min(1).max(80).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Nothing to change." }, { status: 400 });

  let resume = parsed.data.label ? await renameResume(email, id, parsed.data.label) : null;
  if (parsed.data.use) {
    resume = await useResume(email, id);
    // The checks this resume already has stand; the rest are worked through.
    if (resume) kick(email);
  }
  if (!resume) return Response.json({ success: false, error: "That resume isn't here any more." }, { status: 404 });
  return Response.json({
    success: true,
    data: { id: resume.id, label: resume.label, version: resume.version, updatedAt: resume.updatedAt },
  });
}

// Removes this resume and the checks made against it. The most recent of the
// rest takes over; the answer says which, so the browser can follow.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const { id } = await params;
  const next = await deleteResume(email, id);
  kick(email);
  return Response.json({ success: true, data: { active: next && { id: next.id, version: next.version } } });
}
