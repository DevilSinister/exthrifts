"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { fd, run, slugify, UserError, type ActionState } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { parsePakistanLocal } from "@/lib/drops/rules";
import { isValidKey } from "@/lib/images/storage";

function refreshCatalog() {
  revalidatePath("/admin/catalog");
  revalidatePath("/", "layout");
}

// --- categories -------------------------------------------------------------

export async function saveCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.opt(form, "id");
    const name = fd.str(form, "name");
    if (name.length < 2) throw new UserError("Name the category.");
    const parentId = fd.opt(form, "parentId");
    if (parentId && parentId === id) throw new UserError("A category can't be its own parent.");
    const image = fd.opt(form, "imageKey");
    const data = {
      name,
      slug: slugify(fd.str(form, "slug") || name),
      description: fd.opt(form, "description"),
      parentId,
      sortOrder: fd.int(form, "sortOrder") ?? 0,
      showInMenu: fd.bool(form, "showInMenu"),
      imageKey: image && isValidKey(image) ? image : null,
    };
    if (id) await db.category.update({ where: { id }, data });
    else await db.category.create({ data });
    await db.activityLog.create({ data: { actorId: admin.id, action: id ? "category.update" : "category.create", entity: "category", details: { name } } });
    refreshCatalog();
    return id ? "Category saved." : "Category added.";
  });
}

export async function deleteCategoryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.str(form, "id");
    const count = await db.product.count({ where: { categoryId: id } });
    if (count) throw new UserError(`${count} piece(s) use this category. Move them first.`);
    await db.category.delete({ where: { id } });
    await db.activityLog.create({ data: { actorId: admin.id, action: "category.delete", entity: "category", entityId: id } });
    refreshCatalog();
    return "Category deleted.";
  });
}

// --- collections ------------------------------------------------------------

export async function saveCollectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.opt(form, "id");
    const name = fd.str(form, "name");
    if (name.length < 2) throw new UserError("Name the collection.");
    const data = {
      name,
      slug: slugify(fd.str(form, "slug") || name),
      description: fd.opt(form, "description"),
      isActive: fd.bool(form, "isActive"),
      showOnHome: fd.bool(form, "showOnHome"),
      sortOrder: fd.int(form, "sortOrder") ?? 0,
    };
    if (id) await db.collection.update({ where: { id }, data });
    else await db.collection.create({ data });
    await db.activityLog.create({ data: { actorId: admin.id, action: id ? "collection.update" : "collection.create", entity: "collection", details: { name } } });
    refreshCatalog();
    return id ? "Collection saved." : "Collection added. Add pieces to it from each piece's page.";
  });
}

export async function deleteCollectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await assertAdmin();
    await db.collection.delete({ where: { id: fd.str(form, "id") } });
    refreshCatalog();
    return "Collection deleted. Its pieces were not touched.";
  });
}

// --- coupons ----------------------------------------------------------------

export async function saveCouponAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.opt(form, "id");
    const code = fd.str(form, "code").toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new UserError("Codes are 3–40 letters, numbers, - or _.");
    const type = fd.str(form, "type");
    if (type !== "PERCENT" && type !== "FIXED" && type !== "FREE_SHIPPING") throw new UserError("Choose a discount type.");
    const value = fd.int(form, "value") ?? 0;
    if (type === "PERCENT" && (value < 1 || value > 100)) throw new UserError("A percentage is between 1 and 100.");
    if (type === "FIXED" && value < 1) throw new UserError("Enter the rupees off.");
    const startsRaw = fd.str(form, "startsAt");
    const endsRaw = fd.str(form, "endsAt");
    const startsAt = startsRaw ? parsePakistanLocal(startsRaw) : null;
    const endsAt = endsRaw ? parsePakistanLocal(endsRaw) : null;
    if (startsAt && endsAt && endsAt <= startsAt) throw new UserError("The end must be after the start.");
    const data = {
      code,
      type: type as "PERCENT" | "FIXED" | "FREE_SHIPPING",
      value: type === "FREE_SHIPPING" ? 0 : value,
      minSubtotal: fd.int(form, "minSubtotal") ?? 0,
      maxUses: fd.int(form, "maxUses"),
      startsAt,
      endsAt,
      isActive: fd.bool(form, "isActive"),
    };
    if (id) await db.coupon.update({ where: { id }, data });
    else await db.coupon.create({ data });
    await db.activityLog.create({ data: { actorId: admin.id, action: id ? "coupon.update" : "coupon.create", entity: "coupon", details: { code } } });
    revalidatePath("/admin/coupons");
    return `Code ${code} saved.`;
  });
}

export async function deleteCouponAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await assertAdmin();
    const id = fd.str(form, "id");
    const used = await db.order.count({ where: { couponId: id } });
    if (used) {
      await db.coupon.update({ where: { id }, data: { isActive: false } });
      revalidatePath("/admin/coupons");
      return "Used on past orders, so it was switched off instead of deleted.";
    }
    await db.coupon.delete({ where: { id } });
    revalidatePath("/admin/coupons");
    return "Code deleted.";
  });
}

// --- inventory --------------------------------------------------------------

export async function adjustStockAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const productId = fd.str(form, "productId");
    const mode = fd.str(form, "mode");
    const amount = fd.int(form, "amount");
    const reason = fd.str(form, "reason");
    if (amount === null || amount < 0) throw new UserError("Enter a number.");
    if (reason.length < 3) throw new UserError("Say why (e.g. found another one, damaged).");
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { stock: true, soldAt: true } });
      if (!product) throw new UserError("Piece not found.");
      const after = mode === "set" ? amount : mode === "remove" ? Math.max(0, product.stock - amount) : product.stock + amount;
      await tx.product.update({
        where: { id: productId },
        data: { stock: after, soldAt: after > 0 ? null : (product.soldAt ?? new Date()) },
      });
      await tx.inventoryLog.create({ data: { productId, change: after - product.stock, before: product.stock, after, reason, actorId: admin.id } });
    });
    revalidatePath("/admin/inventory");
    return "Stock updated.";
  });
}
