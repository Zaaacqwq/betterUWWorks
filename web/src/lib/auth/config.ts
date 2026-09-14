// Sign-in settings shared by the Auth.js setup (src/auth.ts) and the proxy
// (src/proxy.ts), kept free of heavy imports so the proxy stays light.

export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

// Google sign-in needs all three. Without them `next dev` runs open for the
// local owner and production refuses everyone (see src/proxy.ts).
export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

// Behind the tunnel the server sees plain http, so the public URL decides
// whether the session cookie is the __Secure- one. Auth.js and the proxy
// must agree on that name or every request looks signed out.
export function secureCookies(): boolean {
  return (process.env.AUTH_URL ?? "").startsWith("https://");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
