import { db } from "@/db";
import { jobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db
    .select()
    .from(jobs)
    .where(eq(jobs.jobId, id))
    .limit(1);

  if (result.length === 0) {
    return Response.json(
      { success: false, error: "Job not found" },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: result[0] });
}
