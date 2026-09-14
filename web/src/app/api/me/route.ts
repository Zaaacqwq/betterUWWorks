import { auth } from "@/auth";
import { authConfigured, isProduction } from "@/lib/auth/config";
import { isAdminEmail, statusOf } from "@/lib/auth/users";
import { hasApiKey } from "@/lib/auth/viewer";
import type { UserStatus } from "@/db/schema";

export interface Me {
  signedIn: boolean;
  email: string | null;
  name: string | null;
  image: string | null;
  // null until signed in.
  status: UserStatus | null;
  isAdmin: boolean;
}

const NOBODY: Me = { signedIn: false, email: null, name: null, image: null, status: null, isAdmin: false };

// Who the page is being shown to, and whether they have been let in. Open to
// everyone (src/proxy.ts), since it is what decides between the sign-in card,
// the waiting card and the postings. The server still checks every request
// for data; this only shapes the page.
export async function GET(request: Request) {
  if (hasApiKey(request)) {
    return Response.json({ success: true, data: { ...NOBODY, signedIn: true, status: "approved", isAdmin: true } });
  }
  if (!authConfigured()) {
    // `next dev` without Google set up: the local owner.
    const data: Me = isProduction() ? NOBODY : { ...NOBODY, signedIn: true, status: "approved", isAdmin: true };
    return Response.json({ success: true, data });
  }

  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return Response.json({ success: true, data: NOBODY });

  const status = (await statusOf(email)) ?? "pending";
  const data: Me = {
    signedIn: true,
    email,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
    status,
    isAdmin: status === "approved" && isAdminEmail(email),
  };
  return Response.json({ success: true, data });
}
