import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { VIEWER_EMAIL_HEADER } from "@/lib/auth/viewer";

// A session cookie Auth.js would have issued, by the email it carries.
const SESSIONS: Record<string, string> = {
  "friend-session": "friend@gmail.com",
  "waiting-session": "new@gmail.com",
  "blocked-session": "gone@gmail.com",
};
const STATUSES: Record<string, "approved" | "pending" | "blocked"> = {
  "friend@gmail.com": "approved",
  "new@gmail.com": "pending",
  "gone@gmail.com": "blocked",
};

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(async ({ req }: { req: NextRequest }) => {
    const email = SESSIONS[req.cookies.get("session")?.value ?? ""];
    return email ? { email } : null;
  }),
}));
vi.mock("@/lib/auth/users", () => ({
  statusOf: vi.fn(async (email: string) => STATUSES[email] ?? null),
  touchLastSeen: vi.fn(),
}));

const { proxy } = await import("./proxy");

function req(path: string, headers: Record<string, string> = {}, session?: string): NextRequest {
  const all = session ? { ...headers, cookie: `session=${session}` } : headers;
  return new NextRequest(`https://jobs.example.com${path}`, { headers: all });
}

// What the route handler behind the proxy would see for this header.
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("API_KEY", "secret-key");
  vi.stubEnv("AUTH_SECRET", "s");
  vi.stubEnv("AUTH_GOOGLE_ID", "id");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
});
afterEach(() => vi.unstubAllEnvs());

describe("proxy", () => {
  it("refuses a request that is not signed in", async () => {
    const res = await proxy(req("/api/jobs"));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it("passes an approved viewer on, with their email", async () => {
    const res = await proxy(req("/api/jobs", {}, "friend-session"));
    expect(res.status).toBe(200);
    expect(forwarded(res, VIEWER_EMAIL_HEADER)).toBe("friend@gmail.com");
  });

  it("keeps someone waiting for approval out, and says so", async () => {
    const res = await proxy(req("/api/jobs", {}, "waiting-session"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ status: "pending" });
  });

  it("keeps a blocked user out", async () => {
    const res = await proxy(req("/api/jobs/123", {}, "blocked-session"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ status: "blocked" });
  });

  it("treats a signed-in address with no record as waiting", async () => {
    vi.mocked((await import("@/lib/auth/users")).statusOf).mockResolvedValueOnce(null);
    const res = await proxy(req("/api/jobs", {}, "friend-session"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ status: "pending" });
  });

  it("replaces a viewer header the client tried to set", async () => {
    const res = await proxy(req("/api/jobs", { [VIEWER_EMAIL_HEADER]: "owner@example.com" }, "friend-session"));
    expect(forwarded(res, VIEWER_EMAIL_HEADER)).toBe("friend@gmail.com");
  });

  it("does not let a forged viewer header stand in for signing in", async () => {
    const res = await proxy(req("/api/jobs", { [VIEWER_EMAIL_HEADER]: "owner@example.com" }));
    expect(res.status).toBe(401);
  });

  it("lets the extension through with the key, without an email", async () => {
    const res = await proxy(req("/api/jobs/import", { "x-api-key": "secret-key", [VIEWER_EMAIL_HEADER]: "owner@example.com" }));
    expect(res.status).toBe(200);
    expect(forwarded(res, VIEWER_EMAIL_HEADER)).toBeNull();
  });

  it("leaves signing in and /api/me open", async () => {
    expect((await proxy(req("/api/auth/signin/google"))).status).toBe(200);
    expect((await proxy(req("/api/me"))).status).toBe(200);
  });

  it("does not open neighbours of the open routes", async () => {
    expect((await proxy(req("/api/meta"))).status).toBe(401);
    expect((await proxy(req("/api/authz"))).status).toBe(401);
  });

  it("stays shut in production when sign-in is not configured", async () => {
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    expect((await proxy(req("/api/jobs"))).status).toBe(503);
  });

  it("lets `next dev` through without sign-in configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "");
    expect((await proxy(req("/api/jobs"))).status).toBe(200);
  });
});
