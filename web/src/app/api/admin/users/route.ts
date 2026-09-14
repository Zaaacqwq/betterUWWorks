import { z } from "zod/v4";
import { USER_STATUSES } from "@/db/schema";
import { isAdminEmail, listUsers, removeUser, setStatus } from "@/lib/auth/users";
import { requireAdmin, viewerOf } from "@/lib/auth/viewer";

// The owner's list of everyone who has signed in, and the decisions on it.
// Behind src/proxy.ts (signed in and approved) and requireAdmin here.

export async function GET(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  return Response.json({ success: true, data: await listUsers() });
}

const decisionSchema = z.object({
  email: z.string().trim().min(3).max(320),
  status: z.enum(USER_STATUSES),
});

export async function PATCH(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Send { email, status }." }, { status: 400 });

  const { email, status } = parsed.data;
  // ADMIN_EMAILS are let in whatever the table says, so a decision here would
  // only be misleading.
  if (isAdminEmail(email)) {
    return Response.json({ success: false, error: "The owner's own access can't be changed here." }, { status: 400 });
  }
  const user = await setStatus(email, status, viewerOf(request).email);
  if (!user) return Response.json({ success: false, error: `No one has signed in as ${email}.` }, { status: 404 });
  return Response.json({ success: true, data: user });
}

const removalSchema = z.object({ email: z.string().trim().min(3).max(320) });

export async function DELETE(request: Request) {
  const refusal = requireAdmin(request);
  if (refusal) return refusal;
  const parsed = removalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Send { email }." }, { status: 400 });
  if (isAdminEmail(parsed.data.email)) {
    return Response.json({ success: false, error: "The owner can't be removed." }, { status: 400 });
  }
  const removed = await removeUser(parsed.data.email);
  if (!removed) return Response.json({ success: false, error: `No one has signed in as ${parsed.data.email}.` }, { status: 404 });
  return Response.json({ success: true, data: { email: parsed.data.email } });
}
