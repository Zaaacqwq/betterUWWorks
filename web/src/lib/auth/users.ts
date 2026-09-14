import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, type AppUser, type UserStatus } from "@/db/schema";
import { adminEmails } from "./viewer";

// Who has signed in and what the owner decided about them. Signing in with
// Google only proves who someone is; seeing the postings takes approval.

// Checked on every API request, so briefly remembered. Decisions made here
// clear the entry at once; there is one server process.
const STATUS_TTL_MS = 15_000;
// last_seen_at is for the owner's list, not an audit log.
const LAST_SEEN_EVERY_MS = 5 * 60_000;

const statusCache = new Map<string, { status: UserStatus | null; at: number }>();
const lastSeenWritten = new Map<string, number>();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string): boolean {
  return adminEmails().has(normalizeEmail(email));
}

// The owner is always let in; everyone else starts out waiting.
export function initialStatus(email: string): UserStatus {
  return isAdminEmail(email) ? "approved" : "pending";
}

export async function recordSignIn(profile: {
  email: string;
  name: string | null;
  image: string | null;
}): Promise<{ status: UserStatus; isNew: boolean }> {
  const email = normalizeEmail(profile.email);
  const [row] = await db
    .insert(appUsers)
    .values({ email, name: profile.name, image: profile.image, status: initialStatus(email) })
    .onConflictDoUpdate({
      target: appUsers.email,
      set: { name: sql`excluded.name`, image: sql`excluded.image`, lastSeenAt: new Date() },
    })
    // xmax is 0 on a row this statement inserted, not on one it updated.
    .returning({ status: appUsers.status, isNew: sql<boolean>`(xmax = 0)` });
  statusCache.delete(email);
  return { status: isAdminEmail(email) ? "approved" : row.status, isNew: row.isNew };
}

export async function statusOf(email: string, now = Date.now()): Promise<UserStatus | null> {
  const key = normalizeEmail(email);
  if (isAdminEmail(key)) return "approved";
  const cached = statusCache.get(key);
  if (cached && now - cached.at < STATUS_TTL_MS) return cached.status;
  const [row] = await db.select({ status: appUsers.status }).from(appUsers).where(eq(appUsers.email, key)).limit(1);
  const status = row?.status ?? null;
  statusCache.set(key, { status, at: now });
  return status;
}

export function touchLastSeen(email: string, now = Date.now()): void {
  const key = normalizeEmail(email);
  if (now - (lastSeenWritten.get(key) ?? 0) < LAST_SEEN_EVERY_MS) return;
  lastSeenWritten.set(key, now);
  db.update(appUsers)
    .set({ lastSeenAt: new Date(now) })
    .where(eq(appUsers.email, key))
    .catch((err) => console.error("[auth] could not record last seen for", key, err));
}

// Waiting first, so a new request is the first thing the owner sees.
export async function listUsers(): Promise<AppUser[]> {
  return db
    .select()
    .from(appUsers)
    .orderBy(
      sql`case ${appUsers.status} when 'pending' then 0 when 'approved' then 1 else 2 end`,
      desc(appUsers.lastSeenAt),
      asc(appUsers.email)
    );
}

export async function setStatus(email: string, status: UserStatus, decidedBy: string | null): Promise<AppUser | null> {
  const key = normalizeEmail(email);
  const [row] = await db
    .update(appUsers)
    .set({ status, decidedAt: new Date(), decidedBy })
    .where(eq(appUsers.email, key))
    .returning();
  statusCache.delete(key);
  return row ?? null;
}

// Forgets someone entirely: signing in again makes a fresh request.
export async function removeUser(email: string): Promise<boolean> {
  const key = normalizeEmail(email);
  const rows = await db.delete(appUsers).where(eq(appUsers.email, key)).returning({ email: appUsers.email });
  statusCache.delete(key);
  return rows.length > 0;
}
