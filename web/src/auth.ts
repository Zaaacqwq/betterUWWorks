import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { SESSION_MAX_AGE_S, secureCookies } from "@/lib/auth/config";
import { recordSignIn } from "@/lib/auth/users";
import { notifyOwner } from "@/lib/notify";

// Google sign-in (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET, AUTH_URL in
// .env.local). Anyone with a verified Google address may sign in; that only
// puts them on the owner's list. Whether they see the postings is decided per
// request by src/proxy.ts from app_users.status.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_S },
  trustHost: true,
  useSecureCookies: secureCookies(),
  pages: { signIn: "/", error: "/" },
  callbacks: {
    async signIn({ profile }) {
      const email = typeof profile?.email === "string" ? profile.email : "";
      if (!email || profile?.email_verified !== true) return false;
      const { status, isNew } = await recordSignIn({
        email,
        name: typeof profile.name === "string" ? profile.name : null,
        image: typeof profile.picture === "string" ? profile.picture : null,
      });
      if (isNew && status === "pending") {
        await notifyOwner(
          "New betterUWWorks access request",
          `${profile.name ?? email} (${email}) signed in and is waiting for your approval.`,
          "/admin"
        );
      }
      return true;
    },
  },
});
