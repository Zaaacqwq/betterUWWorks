// Tells the owner's phone something through ntfy (NTFY_TOPIC in .env.local —
// the same topic the extension and the health check use). A notification
// failing never fails the request that raised it.
const NTFY_SERVER = "https://ntfy.sh";
const TIMEOUT_MS = 5000;

export async function notifyOwner(title: string, message: string, clickPath?: string): Promise<void> {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) return;
  const base = process.env.AUTH_URL?.replace(/\/+$/, "");
  try {
    await fetch(NTFY_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        title,
        message,
        tags: ["bust_in_silhouette"],
        ...(base && clickPath ? { click: `${base}${clickPath}` } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[notify] could not reach ntfy:", err);
  }
}
