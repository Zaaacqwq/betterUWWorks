import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/viewer";

// Puts back what the last clear removed. The snapshot is whatever DELETE
// /api/jobs copied aside before emptying the table, so this undoes exactly one
// clear — enough for the case it exists for, which is realising immediately
// that the click was a mistake.
export async function POST(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;

  const [{ exists }] = (await db.execute(
    sql`select to_regclass('public.jobs_snapshot') is not null as exists`
  )).rows as unknown as { exists: boolean }[];

  if (!exists) {
    return Response.json(
      { success: false, error: "No snapshot to restore — nothing has been cleared since the server started keeping them." },
      { status: 404 }
    );
  }

  const [{ count: snapshotCount }] = (await db.execute(
    sql`select count(*)::int as count from jobs_snapshot`
  )).rows as unknown as { count: number }[];

  // Rows already re-imported since the clear win: a restore should not undo a
  // sync the user has done in the meantime.
  const [{ count: restored }] = (await db.execute(
    sql`
      with restored as (
        insert into jobs select * from jobs_snapshot
        on conflict (job_id) do nothing
        returning 1
      )
      select count(*)::int as count from restored
    `
  )).rows as unknown as { count: number }[];

  return Response.json({
    success: true,
    data: { restored, inSnapshot: snapshotCount },
  });
}

export async function GET(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;

  const [{ exists }] = (await db.execute(
    sql`select to_regclass('public.jobs_snapshot') is not null as exists`
  )).rows as unknown as { exists: boolean }[];

  if (!exists) {
    return Response.json({ success: true, data: { snapshot: null } });
  }

  const [row] = (await db.execute(
    sql`
      select count(*)::int as count,
             count(*) filter (where raw_detail is not null)::int as with_detail
      from jobs_snapshot
    `
  )).rows as unknown as { count: number; with_detail: number }[];

  return Response.json({
    success: true,
    data: { snapshot: { jobs: row.count, withDetail: row.with_detail } },
  });
}
