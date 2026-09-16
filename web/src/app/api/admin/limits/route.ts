import { z } from "zod/v4";
import { requireAdmin, viewerOf } from "@/lib/auth/viewer";
import { LIMITS_KEY, aiLimits, DEFAULT_LIMITS, DEFAULT_FULL_CHECKS } from "@/lib/ai/quota";
import { writeSetting } from "@/lib/settings";

// The daily AI allowances, as the owner can change them while the site runs.

const count = z.number().int().min(0).max(10_000);
const bodySchema = z
  .object({
    match: count,
    summary: count,
    resume: count,
    cover: count,
    fullChecks: z.number().int().min(0).max(50),
  })
  .partial();

export async function GET(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  return Response.json({
    success: true,
    data: { limits: await aiLimits(), defaults: { ...DEFAULT_LIMITS, fullChecks: DEFAULT_FULL_CHECKS } },
  });
}

export async function PATCH(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ success: false, error: "Those aren't allowances this can set." }, { status: 400 });
  }
  const next = { ...(await aiLimits()), ...parsed.data };
  await writeSetting(LIMITS_KEY, next, viewerOf(request).email);
  return Response.json({ success: true, data: { limits: next } });
}
