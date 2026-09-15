import { checkDetail } from "@/lib/line-check/detail";
import { checkNow } from "@/lib/line-check/grader";
import { noOwner, resumeOwnerOf } from "@/lib/line-check/owner";

// One posting checked line by line against the student's resume.
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const { jobId } = await params;
  return Response.json({ success: true, data: await checkDetail(email, jobId) });
}

// Checks this posting now, ahead of the queue, and answers with the result —
// or with "pending" if the check failed or ran long, for the page to ask again.
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const { jobId } = await params;
  const before = await checkDetail(email, jobId);
  if (before.status !== "pending") return Response.json({ success: true, data: before });
  await checkNow(email, jobId);
  return Response.json({ success: true, data: await checkDetail(email, jobId) });
}
