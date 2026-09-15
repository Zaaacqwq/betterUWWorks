import { graderState, kick } from "@/lib/line-check/grader";
import { noOwner, resumeOwnerOf } from "@/lib/line-check/owner";
import { checkProgress, checkedScores, getResume, isPaused } from "@/lib/line-check/store";

// The skills score of every posting checked against the student's resume, and
// how far the checking has got. The list asks for this again while checks are
// still coming in.
export async function GET(request: Request) {
  const email = resumeOwnerOf(request);
  if (!email) return noOwner();
  const resume = await getResume(email);
  if (!resume) return Response.json({ success: true, data: null });

  const [scores, progress] = await Promise.all([
    checkedScores(email, resume.version),
    checkProgress(email, resume.version),
  ]);
  const paused = isPaused(resume);
  const state = graderState(email);
  // After a restart nothing is queued in memory: the first look starts it again.
  if (!paused && !state.running && progress.checked < progress.total) kick(email);

  return Response.json({
    success: true,
    data: {
      version: resume.version,
      scores,
      total: progress.total,
      checked: progress.checked,
      running: state.running || (!paused && progress.checked < progress.total),
      paused,
    },
  });
}
