import { timingSafeEqual } from "node:crypto";

// Who is asking. src/proxy.ts is the one place that decides: it checks the
// Google sign-in session and the owner's approval on every API request, and
// hands the approved email on in this header after deleting any copy a client
// sent. Requests made on the machine itself (the extension syncing) carry no
// email and prove themselves with the API key instead.
export const VIEWER_EMAIL_HEADER = "x-buw-viewer-email";
const API_KEY_HEADER = "x-api-key";

export interface Viewer {
  email: string | null;
  isAdmin: boolean;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function viewerOf(request: Request): Viewer {
  const email = request.headers.get(VIEWER_EMAIL_HEADER)?.trim().toLowerCase() || null;
  if (email) return { email, isAdmin: adminEmails().has(email) };
  // No Access in front of `next dev`: whoever runs it locally is the owner.
  return { email: null, isAdmin: !isProduction() };
}

export function hasApiKey(request: Request): boolean {
  const expected = process.env.API_KEY;
  const given = request.headers.get(API_KEY_HEADER);
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// For anything that deletes, restores or spends model time across the whole
// table. Answers with the refusal, or null when the caller may go ahead.
export function requireAdmin(request: Request): Response | null {
  if (hasApiKey(request) || viewerOf(request).isAdmin) return null;
  return Response.json(
    { success: false, error: "Only the site owner can do this." },
    { status: 403 }
  );
}
