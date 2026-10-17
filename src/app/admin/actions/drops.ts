"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { fd, run, slugify, UserError, type ActionState } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { canAddToDrop, canRemoveFromDrop, checkSchedule, dropPhase, parsePakistanLocal } from "@/lib/drops/rules";
import { isValidKey } from "@/lib/images/storage";

async function uniqueDropSlug(name: string, exceptId?: string): Promise<string> {
  const root = slugify(name) || "drop";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i ? `${root}-${i + 1}` : root;
    const clash = await db.drop.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash || clash.id === exceptId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

function refresh(dropId?: string) {
  revalidatePath("/admin/drops");
  if (dropId) revalidatePath(`/admin/drops/${dropId}`);
  revalidatePath("/", "layout");
}

function readCommon(form: FormData) {
  const name = fd.str(form, "name");
  if (name.length < 2) throw new UserError("Give the drop a name.");
  const cover = fd.opt(form, "coverKey");
  return {
    name,
    description: fd.opt(form, "description"),
    coverKey: cover && isValidKey(cover) ? cover : null,
    showPreview: fd.bool(form, "showPreview"),
    announce: fd.bool(form, "announce"),
  };
}

export async function createDropAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string | null = null;
  const result = await run(async () => {
    const admin = await assertAdmin();
    const common = readCommon(form);
    const startsAt = parsePakistanLocal(fd.str(form, "startsAt"));
    // Pieces are added on the next screen; the countdown only shows once the drop has pieces.
    const problem = checkSchedule({ startsAt, productCount: 1, now: new Date() });
    if (problem) throw new UserError(problem);
    const drop = await db.drop.create({ data: { ...common, slug: await uniqueDropSlug(common.name), startsAt } });
    await db.activityLog.create({ data: { actorId: admin.id, action: "drop.create", entity: "drop", entityId: drop.id, details: { name: drop.name } } });
    id = drop.id;
  });
  if (id) redirect(`/admin/drops/${id}?created=1`);
  return result;
}

async function loadEditable(id: string) {
  const drop = await db.drop.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!drop) throw new UserError("Drop not found.");
  return { drop, phase: dropPhase(drop, new Date()) };
}

export async function updateDropAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const { drop, phase } = await loadEditable(fd.str(form, "id"));
    if (phase === "cancelled") throw new UserError("This drop was cancelled.");
    const common = readCommon(form);
    const data: Record<string, unknown> = { ...common, slug: await uniqueDropSlug(common.name, drop.id) };
    if (phase === "scheduled") {
      const startsAt = parsePakistanLocal(fd.str(form, "startsAt"));
      const problem = checkSchedule({ startsAt, productCount: Math.max(drop._count.products, 1), now: new Date() });
      if (problem) throw new UserError(problem);
      data.startsAt = startsAt;
      // Keep "new in" ordering in step with the launch time.
      await db.product.updateMany({ where: { dropId: drop.id }, data: { publishedAt: startsAt } });
    }
    await db.drop.update({ where: { id: drop.id }, data });
    await db.activityLog.create({ data: { actorId: admin.id, action: "drop.update", entity: "drop", entityId: drop.id } });
    refresh(drop.id);
    return "Drop saved.";
  });
}

export async function addToDropAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const { drop, phase } = await loadEditable(fd.str(form, "dropId"));
    if (phase !== "scheduled") throw new UserError("Pieces can only be added before the drop goes live.");
    const ids = fd.list(form, "productIds").slice(0, 200);
    if (!ids.length) throw new UserError("Tick the drafts to add.");
    const products = await db.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, dropId: true, price: true, size: true, categoryId: true, _count: { select: { images: true } } },
    });
    const added: string[] = [];
    const skipped: string[] = [];
    for (const p of products) {
      const problem = canAddToDrop(p, drop.id) ?? (!p._count.images || !p.price || !p.size || !p.categoryId ? "needs photo, price, size and category" : null);
      if (problem) {
        skipped.push(problem);
        continue;
      }
      // Published-with-a-drop stays invisible until startsAt (see visibility.ts).
      await db.product.update({ where: { id: p.id }, data: { dropId: drop.id, status: "PUBLISHED", publishedAt: drop.startsAt } });
      added.push(p.id);
    }
    await db.activityLog.create({ data: { actorId: admin.id, action: "drop.add", entity: "drop", entityId: drop.id, details: { count: added.length } } });
    refresh(drop.id);
    if (!added.length) throw new UserError(`Nothing added: ${skipped[0] ?? "no drafts selected"}.`);
    return `${added.length} added${skipped.length ? `, ${skipped.length} skipped (${skipped[0]})` : ""}.`;
  });
}

export async function removeFromDropAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const { drop, phase } = await loadEditable(fd.str(form, "dropId"));
    const productId = fd.str(form, "productId");
    const orders = await db.orderItem.count({ where: { productId } });
    const problem = canRemoveFromDrop(phase, orders);
    if (problem) throw new UserError(problem);
    await db.product.updateMany({ where: { id: productId, dropId: drop.id }, data: { dropId: null, status: "DRAFT", publishedAt: null } });
    await db.activityLog.create({ data: { actorId: admin.id, action: "drop.remove", entity: "drop", entityId: drop.id, details: { productId } } });
    refresh(drop.id);
    return "Moved back to drafts.";
  });
}

export async function goLiveNowAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const { drop, phase } = await loadEditable(fd.str(form, "id"));
    if (phase !== "scheduled") throw new UserError("This drop isn't waiting to launch.");
    const now = new Date();
    const problem = checkSchedule({ startsAt: now, productCount: drop._count.products, now, allowNow: true });
    if (problem) throw new UserError(problem);
    await db.$transaction([
      db.drop.update({ where: { id: drop.id }, data: { startsAt: now } }),
      db.product.updateMany({ where: { dropId: drop.id }, data: { publishedAt: now } }),
      db.activityLog.create({ data: { actorId: admin.id, action: "drop.live", entity: "drop", entityId: drop.id } }),
    ]);
    refresh(drop.id);
    return "The drop is live.";
  });
}

export async function cancelDropAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const { drop, phase } = await loadEditable(fd.str(form, "id"));
    if (phase !== "scheduled") throw new UserError("Only a drop that hasn't started can be cancelled.");
    await db.$transaction([
      db.product.updateMany({ where: { dropId: drop.id }, data: { dropId: null, status: "DRAFT", publishedAt: null } }),
      db.drop.update({ where: { id: drop.id }, data: { cancelledAt: new Date() } }),
      db.activityLog.create({ data: { actorId: admin.id, action: "drop.cancel", entity: "drop", entityId: drop.id } }),
    ]);
    refresh(drop.id);
    return "Drop cancelled. Its pieces are back in drafts.";
  });
}
