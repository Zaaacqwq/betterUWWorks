// Runs once when the server starts. The line-by-line checks, and the tagging
// and embedding they rest on, live in this process; after a restart they are
// picked up again here rather than waiting for someone to open the site.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resumeBackgroundWork } = await import("./lib/line-check/startup");
  resumeBackgroundWork();
}
