import { afterEach, describe, expect, it, vi } from "vitest";
import { VIEWER_EMAIL_HEADER, hasApiKey, requireAdmin, viewerOf } from "./viewer";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3000/api/jobs", { headers });
}

afterEach(() => vi.unstubAllEnvs());

describe("viewerOf", () => {
  it("names an admin from ADMIN_EMAILS, ignoring case and spacing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAILS", " Owner@Example.com , other@example.com");
    expect(viewerOf(req({ [VIEWER_EMAIL_HEADER]: "owner@example.COM" }))).toEqual({
      email: "owner@example.com",
      isAdmin: true,
    });
  });

  it("treats any other signed-in email as a regular viewer", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(viewerOf(req({ [VIEWER_EMAIL_HEADER]: "friend@uwaterloo.ca" }))).toEqual({
      email: "friend@uwaterloo.ca",
      isAdmin: false,
    });
  });

  it("gives a request without Access no admin rights in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(viewerOf(req())).toEqual({ email: null, isAdmin: false });
  });

  it("lets the local developer act as owner outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(viewerOf(req())).toEqual({ email: null, isAdmin: true });
  });
});

describe("hasApiKey", () => {
  it("accepts only the configured key", () => {
    vi.stubEnv("API_KEY", "secret-key");
    expect(hasApiKey(req({ "x-api-key": "secret-key" }))).toBe(true);
    expect(hasApiKey(req({ "x-api-key": "secret-kez" }))).toBe(false);
    expect(hasApiKey(req({ "x-api-key": "short" }))).toBe(false);
    expect(hasApiKey(req())).toBe(false);
  });

  it("accepts nothing when no key is configured", () => {
    vi.stubEnv("API_KEY", "");
    expect(hasApiKey(req({ "x-api-key": "" }))).toBe(false);
    expect(hasApiKey(req({ "x-api-key": "anything" }))).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("lets the extension through with the key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_KEY", "secret-key");
    expect(requireAdmin(req({ "x-api-key": "secret-key" }))).toBeNull();
  });

  it("lets an admin email through without a key", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(requireAdmin(req({ [VIEWER_EMAIL_HEADER]: "owner@example.com" }))).toBeNull();
  });

  it("refuses a friend with 403", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    const refusal = requireAdmin(req({ [VIEWER_EMAIL_HEADER]: "friend@uwaterloo.ca" }));
    expect(refusal?.status).toBe(403);
    expect(await refusal?.json()).toMatchObject({ success: false });
  });

  it("fails closed in production when no key is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_KEY", "");
    expect(requireAdmin(req())?.status).toBe(403);
  });
});
