"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth";
import { fd, run, slugify, UserError, type ActionState } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { deleteImage, isValidKey } from "@/lib/images/storage";

const imagesSchema = z
  .array(
    z.object({
      key: z.string().refine(isValidKey, "Bad image"),
      alt: z.string().max(200).default(""),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
  )
  .max(12, "Up to 12 photos per piece.");

const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
const MEASURE_KEYS = ["chest", "length", "shoulder", "sleeve", "waist", "inseam"] as const;

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "piece";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const clash = await db.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash || clash.id === exceptId) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function saveProductAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const result = await run(async () => {
    const admin = await assertAdmin();
    const id = fd.opt(form, "id");
    const existing = id
      ? await db.product.findUnique({ where: { id }, include: { images: true, collections: { select: { id: true } } } })
      : null;
    if (id && !existing) throw new UserError("This piece no longer exists.");

    const title = fd.str(form, "title");
    if (title.length < 3) throw new UserError("Give the piece a title.");
    const price = fd.int(form, "price");
    if (price === null || price < 0) throw new UserError("Enter a price in rupees.");
    const stock = Math.max(0, fd.int(form, "stock") ?? 1);
    const condition = fd.int(form, "conditionGrade");
    if (condition !== null && (condition < 1 || condition > 10)) throw new UserError("Condition is a grade from 1 to 10.");

    const images = imagesSchema.parse(JSON.parse(fd.str(form, "images") || "[]"));
    const measurements: Record<string, number> = {};
    for (const key of MEASURE_KEYS) {
      const v = fd.num(form, `m_${key}`);
      if (v !== null && v > 0 && v < 200) measurements[key] = Math.round(v * 10) / 10;
    }
    const tags = fd
      .str(form, "tags")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);

    // Pieces inside a drop have their status managed by the drop.
    const inDrop = Boolean(existing?.dropId);
    const statusRaw = fd.str(form, "status");
    const status = inDrop ? existing!.status : STATUSES.includes(statusRaw as never) ? (statusRaw as (typeof STATUSES)[number]) : "DRAFT";
    const categoryId = fd.opt(form, "categoryId");
    const size = fd.opt(form, "size");

    if (status === "PUBLISHED") {
      const missing = [!images.length && "a photo", !price && "a price", !size && "a size", !categoryId && "a category"].filter(Boolean);
      if (missing.length) throw new UserError(`To publish, add ${missing.join(", ")}. Or save it as a draft.`);
    }

    const slug = await uniqueSlug(fd.str(form, "slug") || title, existing?.id);
    const now = new Date();
    const data = {
      title,
      slug,
      description: fd.opt(form, "description"),
      status,
      price,
      compareAtPrice: fd.int(form, "compareAtPrice"),
      costPrice: fd.int(form, "costPrice"),
      size,
      measurements,
      conditionGrade: condition,
      conditionNotes: fd.opt(form, "conditionNotes"),
      brand: fd.opt(form, "brand"),
      era: fd.opt(form, "era"),
      tags,
      seoTitle: fd.opt(form, "seoTitle"),
      seoDescription: fd.opt(form, "seoDescription"),
      categoryId,
      stock,
      soldAt: stock > 0 ? null : (existing?.soldAt ?? now),
      publishedAt: status === "PUBLISHED" ? (existing?.publishedAt ?? now) : (existing?.publishedAt ?? null),
    };
    const collectionIds = fd.list(form, "collectionIds");

    const saved = await db.$transaction(async (tx) => {
      const product = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data: { ...data, collections: { set: collectionIds.map((c) => ({ id: c })) } },
          })
        : await tx.product.create({ data: { ...data, collections: { connect: collectionIds.map((c) => ({ id: c })) } } });

      await tx.productImage.deleteMany({ where: { productId: product.id } });
      if (images.length) {
        await tx.productImage.createMany({
          data: images.map((img, i) => ({ productId: product.id, key: img.key, alt: img.alt.trim(), width: img.width, height: img.height, sortOrder: i })),
        });
      }
      const before = existing?.stock ?? 0;
      if (!existing || before !== stock) {
        await tx.inventoryLog.create({
          data: { productId: product.id, change: stock - before, before, after: stock, reason: existing ? "Edited in product form" : "Listed", actorId: admin.id },
        });
      }
      await tx.activityLog.create({
        data: { actorId: admin.id, action: existing ? "product.update" : "product.create", entity: "product", entityId: product.id, details: { title, status } },
      });
      return product;
    });

    // Remove files for photos taken off this piece.
    if (existing) {
      const kept = new Set(images.map((i) => i.key));
      await Promise.all(existing.images.filter((i) => !kept.has(i.key)).map((i) => deleteImage(i.key)));
    }
    revalidatePath("/admin/products");
    revalidatePath(`/products/${saved.slug}`);
    if (!existing) createdId = saved.id;
    return status === "PUBLISHED" ? "Saved and live." : status === "DRAFT" ? "Saved as draft." : "Saved (hidden).";
  });
  if (createdId) redirect(`/admin/products/${createdId}?created=1`);
  return result;
}

export async function markSoldAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.str(form, "id");
    const product = await db.product.findUnique({ where: { id }, select: { stock: true } });
    if (!product) throw new UserError("Piece not found.");
    if (product.stock === 0) throw new UserError("Already sold out.");
    await db.$transaction([
      db.product.update({ where: { id }, data: { stock: 0, soldAt: new Date() } }),
      db.inventoryLog.create({ data: { productId: id, change: -product.stock, before: product.stock, after: 0, reason: "Marked sold (sold elsewhere)", actorId: admin.id } }),
    ]);
    revalidatePath(`/admin/products/${id}`);
    return "Marked sold. It shows with SOLD for 7 days.";
  });
}

export async function duplicateProductAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let newId: string | null = null;
  const result = await run(async () => {
    const admin = await assertAdmin();
    const source = await db.product.findUnique({ where: { id: fd.str(form, "id") }, include: { collections: { select: { id: true } } } });
    if (!source) throw new UserError("Piece not found.");
    const copy = await db.product.create({
      data: {
        title: `${source.title} (copy)`,
        slug: await uniqueSlug(`${source.title} copy`),
        description: source.description,
        status: "DRAFT",
        price: source.price,
        compareAtPrice: source.compareAtPrice,
        costPrice: source.costPrice,
        stock: 1,
        size: source.size,
        measurements: source.measurements ?? undefined,
        conditionGrade: source.conditionGrade,
        conditionNotes: source.conditionNotes,
        brand: source.brand,
        era: source.era,
        tags: source.tags ?? undefined,
        categoryId: source.categoryId,
        collections: { connect: source.collections },
      },
    });
    await db.activityLog.create({ data: { actorId: admin.id, action: "product.duplicate", entity: "product", entityId: copy.id } });
    newId = copy.id;
  });
  // Photos are not copied: a new piece needs its own photos.
  if (newId) redirect(`/admin/products/${newId}?duplicated=1`);
  return result;
}

export async function bulkProductsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const ids = fd.list(form, "ids").slice(0, 500);
    const op = fd.str(form, "op");
    if (!ids.length) throw new UserError("Tick at least one piece.");

    if (op === "publish" || op === "hide" || op === "draft") {
      const status = op === "publish" ? "PUBLISHED" : op === "hide" ? "HIDDEN" : "DRAFT";
      const targets = await db.product.findMany({
        where: { id: { in: ids }, dropId: null },
        select: { id: true, price: true, size: true, categoryId: true, publishedAt: true, _count: { select: { images: true } } },
      });
      const ready = status === "PUBLISHED" ? targets.filter((p) => p._count.images && p.price && p.size && p.categoryId) : targets;
      for (const p of ready) {
        await db.product.update({ where: { id: p.id }, data: { status, ...(status === "PUBLISHED" && !p.publishedAt ? { publishedAt: new Date() } : {}) } });
      }
      await db.activityLog.create({ data: { actorId: admin.id, action: `product.bulk.${op}`, entity: "product", details: { count: ready.length } } });
      revalidatePath("/admin/products");
      const skipped = ids.length - ready.length;
      return `${ready.length} updated${skipped ? `, ${skipped} skipped (in a drop, or missing photo/price/size/category)` : ""}.`;
    }
    if (op === "category") {
      const categoryId = fd.opt(form, "categoryId");
      if (!categoryId) throw new UserError("Choose a category.");
      const { count } = await db.product.updateMany({ where: { id: { in: ids } }, data: { categoryId } });
      revalidatePath("/admin/products");
      return `${count} moved.`;
    }
    if (op === "delete") {
      const ordered = await db.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ["productId"] });
      const blocked = new Set(ordered.map((o) => o.productId));
      const deletable = ids.filter((id) => !blocked.has(id));
      const images = await db.productImage.findMany({ where: { productId: { in: deletable } }, select: { key: true } });
      await db.product.deleteMany({ where: { id: { in: deletable } } });
      await Promise.all(images.map((i) => deleteImage(i.key)));
      await db.activityLog.create({ data: { actorId: admin.id, action: "product.bulk.delete", entity: "product", details: { count: deletable.length } } });
      revalidatePath("/admin/products");
      return `${deletable.length} deleted${blocked.size ? `, ${blocked.size} kept because they were ordered (hide them instead)` : ""}.`;
    }
    throw new UserError("Choose an action.");
  });
}
