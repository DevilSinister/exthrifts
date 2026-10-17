// Storefront reads. Every query that returns products goes through the
// visibility rule in visibility.ts.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  buyableWhere,
  listedOrderBy,
  listedWhere,
  shopperState,
  type ShopperState,
} from "@/lib/catalog/visibility";

export const PAGE_SIZE = 24;

export interface Measurements {
  chest?: number;
  length?: number;
  shoulder?: number;
  sleeve?: number;
  waist?: number;
  inseam?: number;
}

export interface CardImage {
  key: string;
  alt: string;
  width: number;
  height: number;
}

export interface ProductCardData {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  size: string | null;
  measurements: Measurements;
  conditionGrade: number | null;
  brand: string | null;
  images: CardImage[];
  state: ShopperState;
}

const cardInclude = {
  drop: { select: { startsAt: true, cancelledAt: true } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function asMeasurements(value: unknown): Measurements {
  if (!value || typeof value !== "object") return {};
  const out: Measurements = {};
  for (const key of ["chest", "length", "shoulder", "sleeve", "waist", "inseam"] as const) {
    const n = Number((value as Record<string, unknown>)[key]);
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

export function toCard(p: CardRow, now: Date): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    size: p.size,
    measurements: asMeasurements(p.measurements),
    conditionGrade: p.conditionGrade,
    brand: p.brand,
    images: p.images.map((i) => ({ key: i.key, alt: i.alt || p.title, width: i.width, height: i.height })),
    state: shopperState(p, now),
  };
}

export interface ListFilters {
  q?: string;
  category?: string; // slug (includes child categories)
  collection?: string; // slug
  size?: string;
  brand?: string;
  minCondition?: number;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  sort?: "new" | "price-asc" | "price-desc";
  page?: number;
}

export async function listProducts(filters: ListFilters, now = new Date()) {
  const and: Prisma.ProductWhereInput[] = [filters.availableOnly ? buyableWhere(now) : listedWhere(now)];
  if (filters.q) {
    const q = filters.q.slice(0, 80);
    and.push({ OR: [{ title: { contains: q } }, { brand: { contains: q } }, { era: { contains: q } }] });
  }
  if (filters.category) {
    and.push({ category: { OR: [{ slug: filters.category }, { parent: { slug: filters.category } }] } });
  }
  if (filters.collection) and.push({ collections: { some: { slug: filters.collection, isActive: true } } });
  if (filters.size) and.push({ size: filters.size });
  if (filters.brand) and.push({ brand: filters.brand });
  if (filters.minCondition) and.push({ conditionGrade: { gte: filters.minCondition } });
  if (filters.minPrice) and.push({ price: { gte: filters.minPrice } });
  if (filters.maxPrice) and.push({ price: { lte: filters.maxPrice } });

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.sort === "price-asc"
      ? [{ soldAt: "asc" }, { price: "asc" }]
      : filters.sort === "price-desc"
        ? [{ soldAt: "asc" }, { price: "desc" }]
        : listedOrderBy;

  const page = Math.max(1, Math.min(filters.page ?? 1, 500));
  const where: Prisma.ProductWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    db.product.findMany({ where, include: cardInclude, orderBy, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.product.count({ where }),
  ]);
  return { items: rows.map((r) => toCard(r, now)), total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Distinct sizes and brands among listed products, for the filter bar. */
export async function filterOptions(categorySlug?: string, now = new Date()) {
  const where: Prisma.ProductWhereInput = {
    AND: [
      listedWhere(now),
      ...(categorySlug ? [{ category: { OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] } }] : []),
    ],
  };
  const [sizes, brands] = await Promise.all([
    db.product.findMany({ where: { AND: [where, { size: { not: null } }] }, distinct: ["size"], select: { size: true }, take: 40 }),
    db.product.findMany({ where: { AND: [where, { brand: { not: null } }] }, distinct: ["brand"], select: { brand: true }, take: 60 }),
  ]);
  return {
    sizes: sizes.map((s) => s.size!).sort(sizeOrder),
    brands: brands.map((b) => b.brand!).sort((a, b) => a.localeCompare(b)),
  };
}

const SIZE_RANK = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
function sizeOrder(a: string, b: string): number {
  const ra = SIZE_RANK.indexOf(a.toUpperCase());
  const rb = SIZE_RANK.indexOf(b.toUpperCase());
  if (ra !== -1 && rb !== -1) return ra - rb;
  if (ra !== -1) return -1;
  if (rb !== -1) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

export async function menuCategories() {
  return db.category.findMany({
    where: { showInMenu: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, imageKey: true },
  });
}

/** Category tiles: each top-level category with a cover (its own image or its newest listed piece). */
export async function categoryTiles(now = new Date()) {
  const categories = await menuCategories();
  return Promise.all(
    categories.map(async (c) => {
      if (c.imageKey) return { ...c, cover: { key: c.imageKey, alt: c.name } };
      const p = await db.product.findFirst({
        where: { AND: [listedWhere(now), { category: { OR: [{ id: c.id }, { parentId: c.id }] } }] },
        orderBy: listedOrderBy,
        select: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { key: true, alt: true } } },
      });
      return { ...c, cover: p?.images[0] ?? null };
    }),
  );
}

export async function getProductPage(slug: string, now = new Date()) {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true } },
      drop: { select: { startsAt: true, cancelledAt: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product) return null;
  const state = shopperState(product, now);
  if (state === "hidden") return null;
  return { product, state, measurements: asMeasurements(product.measurements) };
}

export async function relatedProducts(productId: string, categoryId: string | null, now = new Date()) {
  const rows = await db.product.findMany({
    where: { AND: [buyableWhere(now), { id: { not: productId } }, ...(categoryId ? [{ categoryId }] : [])] },
    include: cardInclude,
    orderBy: listedOrderBy,
    take: 4,
  });
  return rows.map((r) => toCard(r, now));
}

/** The next drop to count down to in the announcement bar (scheduled, announced, not cancelled). */
export async function nextAnnouncedDrop(now = new Date()) {
  return db.drop.findFirst({
    // A drop with no pieces yet isn't announced.
    where: { announce: true, cancelledAt: null, startsAt: { gt: now }, products: { some: {} } },
    orderBy: { startsAt: "asc" },
    select: { name: true, slug: true, startsAt: true },
  });
}

/** A drop that went live in the last 24 hours, for the "is LIVE" bar state. */
export async function recentlyLiveDrop(now = new Date()) {
  return db.drop.findFirst({
    where: { announce: true, cancelledAt: null, startsAt: { lte: now, gt: new Date(now.getTime() - 86_400_000) }, products: { some: {} } },
    orderBy: { startsAt: "desc" },
    select: { name: true, slug: true, startsAt: true },
  });
}

export async function getDropPage(slug: string, now = new Date()) {
  const drop = await db.drop.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        include: cardInclude,
        orderBy: [{ soldAt: "asc" }, { price: "desc" }],
      },
    },
  });
  if (!drop || drop.cancelledAt) return null;
  return { drop, items: drop.products.map((p) => toCard(p, now)), live: drop.startsAt <= now };
}

export async function homeCollections(now = new Date()) {
  const collections = await db.collection.findMany({
    where: { isActive: true, showOnHome: true },
    orderBy: { sortOrder: "asc" },
    take: 3,
    include: { products: { where: listedWhere(now), include: cardInclude, orderBy: listedOrderBy, take: 8 } },
  });
  return collections
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, items: c.products.map((p) => toCard(p, now)) }))
    .filter((c) => c.items.length > 0);
}
