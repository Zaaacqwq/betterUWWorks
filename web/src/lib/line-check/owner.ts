import { viewerOf } from "@/lib/auth/viewer";
import { isProduction } from "@/lib/auth/config";

// Whose resume a request is about: the signed-in student. `next dev` has no
// sign-in, so whoever runs it locally keeps theirs under one fixed name.
const DEV_OWNER = "dev@localhost";

export function resumeOwnerOf(request: Request): string | null {
  return viewerOf(request).email ?? (isProduction() ? null : DEV_OWNER);
}

export function noOwner(): Response {
  return Response.json({ success: false, error: "Sign in to keep a resume here." }, { status: 401 });
}
