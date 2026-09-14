import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authConfigured, isProduction, secureCookies } from "@/lib/auth/config";
import { statusOf, touchLastSeen } from "@/lib/auth/users";
import { VIEWER_EMAIL_HEADER, hasApiKey } from "@/lib/auth/viewer";

// The site's one trust boundary. Pages are only a shell — every posting comes
// through /api — so the API is what is guarded: a signed-in Google user the
// owner has approved, or the API key (the extension and scripts on the server
// itself). The approved email is passed on in VIEWER_EMAIL_HEADER, and a
// client-sent copy never survives.

// Signing in, and asking who you are, have to work before you are let in.
function isOpenApi(pathname: string): boolean {
  return pathname.startsWith("/api/auth/") || pathname === "/api/me";
}

function refuse(status: number, error: string, extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ success: false, error, ...extra }, { status });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const headers = new Headers(request.headers);
  headers.delete(VIEWER_EMAIL_HEADER);
  const pass = () => NextResponse.next({ request: { headers } });

  if (isOpenApi(request.nextUrl.pathname) || hasApiKey(request)) return pass();

  if (!authConfigured()) {
    // `next dev` without Google set up runs open for the local owner;
    // production without it stays shut.
    return isProduction() ? refuse(503, "Sign-in is not configured on this server.") : pass();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: secureCookies(),
  });
  const email = typeof token?.email === "string" ? token.email.trim().toLowerCase() : "";
  if (!email) return refuse(401, "Sign in to continue.");

  const status = await statusOf(email);
  if (status !== "approved") {
    return refuse(
      403,
      status === "blocked" ? "Your access has been removed." : "Waiting for the owner to approve your access.",
      { status: status ?? "pending" }
    );
  }

  touchLastSeen(email);
  headers.set(VIEWER_EMAIL_HEADER, email);
  return pass();
}

export const config = {
  matcher: ["/api/:path*"],
};
