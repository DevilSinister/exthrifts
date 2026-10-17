import type { MetadataRoute } from "next";
import { buyableWhere } from "@/lib/catalog/visibility";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// In-stock live pieces only: sold pieces stay reachable by link but leave the index.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, categories, collections, pages, drops] = await Promise.all([
    db.product.findMany({ where: buyableWhere(now), select: { slug: true, updatedAt: true }, take: 5000 }),
    db.category.findMany({ select: { slug: true, updatedAt: true } }),
    db.collection.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    db.drop.findMany({ where: { cancelledAt: null }, select: { slug: true, updatedAt: true }, orderBy: { startsAt: "desc" }, take: 20 }),
  ]);
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: absoluteUrl(`/category/${c.slug}`), lastModified: c.updatedAt, priority: 0.8 })),
    ...collections.map((c) => ({ url: absoluteUrl(`/collections/${c.slug}`), lastModified: c.updatedAt, priority: 0.7 })),
    ...drops.map((d) => ({ url: absoluteUrl(`/drops/${d.slug}`), lastModified: d.updatedAt, priority: 0.6 })),
    ...products.map((p) => ({ url: absoluteUrl(`/products/${p.slug}`), lastModified: p.updatedAt, priority: 0.7 })),
    ...pages.map((p) => ({ url: absoluteUrl(`/pages/${p.slug}`), lastModified: p.updatedAt, priority: 0.3 })),
  ];
}
