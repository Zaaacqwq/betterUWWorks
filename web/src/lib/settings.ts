import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

// Numbers the owner can change from /admin without a deploy. Read often (every
// model call checks an allowance), so they are held for a few seconds rather
// than fetched each time.

const CACHE_MS = 10_000;
const cache = new Map<string, { at: number; value: unknown }>();

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const held = cache.get(key);
  if (held && Date.now() - held.at < CACHE_MS) return (held.value as T) ?? fallback;
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  const value = (row?.value as T) ?? fallback;
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function writeSetting(key: string, value: unknown, by: string | null): Promise<void> {
  const row = { key, value, updatedAt: new Date(), updatedBy: by };
  await db.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: row });
  cache.set(key, { at: Date.now(), value });
}

export function forgetSettings(): void {
  cache.clear();
}
