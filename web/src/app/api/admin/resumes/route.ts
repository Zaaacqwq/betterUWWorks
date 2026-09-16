import { z } from "zod/v4";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { lineGrades, resumes } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/viewer";

// The resumes a student has here, for the owner. Everything on this server is
// the owner's to see already; this is the way to see it without opening the
// database, and the privacy page says so.

const querySchema = z.object({
  // Only ever a lookup key, so it is bounded rather than checked as an address.
  email: z.string().trim().min(3).max(320),
  // With an id, the resume's own text comes too.
  id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    email: url.searchParams.get("email") ?? "",
    id: url.searchParams.get("id") ?? undefined,
  });
  if (!parsed.success) return Response.json({ success: false, error: "Which student?" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();

  if (parsed.data.id) {
    const [row] = await db
      .select({ text: resumes.text, label: resumes.label, fileName: resumes.fileName, updatedAt: resumes.updatedAt })
      .from(resumes)
      .where(and(eq(resumes.email, email), eq(resumes.id, parsed.data.id)))
      .limit(1);
    if (!row) return Response.json({ success: false, error: "No such resume." }, { status: 404 });
    return Response.json({ success: true, data: row });
  }

  const [held, counts] = await Promise.all([
    db
      .select({
        id: resumes.id,
        label: resumes.label,
        fileName: resumes.fileName,
        active: resumes.active,
        version: resumes.version,
        updatedAt: resumes.updatedAt,
        lines: sql<number>`jsonb_array_length(${resumes.lines})::int`,
      })
      .from(resumes)
      .where(eq(resumes.email, email)),
    db
      .select({ resumeId: lineGrades.resumeId, checked: sql<number>`count(*)::int` })
      .from(lineGrades)
      .where(eq(lineGrades.email, email))
      .groupBy(lineGrades.resumeId),
  ]);
  const checkedBy = new Map(counts.map((c) => [c.resumeId, c.checked]));
  return Response.json({
    success: true,
    data: { resumes: held.map((r) => ({ ...r, checked: checkedBy.get(r.id) ?? 0 })) },
  });
}
