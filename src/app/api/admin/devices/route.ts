import { z } from "zod";
import { AuthError, assertAdmin, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  token: z.string().min(20).max(512),
  label: z.string().trim().max(80).optional(),
});

/** Registers (or refreshes) this phone's FCM token for the signed-in admin. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  try {
    const admin = await assertAdmin();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid token" }, { status: 400 });
    const { token, label } = parsed.data;

    const existing = await db.adminDevice.findUnique({ where: { token }, select: { id: true } });
    // A token belongs to one app install; if another admin used this phone before, it moves to whoever is signed in now.
    await db.adminDevice.upsert({
      where: { token },
      create: { token, label: label ?? null, userId: admin.id },
      update: { userId: admin.id, lastSeenAt: new Date(), ...(label ? { label } : {}) },
    });
    if (!existing) {
      await db.activityLog.create({ data: { actorId: admin.id, action: "device.paired", entity: "device", details: { label: label ?? null } } });
    }
    return Response.json({ ok: true, created: !existing });
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[devices] pair failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
