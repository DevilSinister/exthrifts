import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { ProductsList } from "@/components/admin/ProductsList";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { shopperState } from "@/lib/catalog/visibility";
import { db } from "@/lib/db";

export const metadata = { title: "Pieces" };
const PAGE = 60;

const VIEWS = [
  ["all", "All"],
  ["live", "On the rack"],
  ["draft", "Drafts"],
  ["scheduled", "In a drop"],
  ["sold", "Sold"],
  ["hidden", "Hidden"],
] as const;

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const view = VIEWS.some(([v]) => v === sp.view) ? (sp.view as (typeof VIEWS)[number][0]) : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const categoryId = typeof sp.category === "string" ? sp.category : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();

  const and: Prisma.ProductWhereInput[] = [];
  if (view === "live") and.push({ status: "PUBLISHED", stock: { gt: 0 }, OR: [{ dropId: null }, { drop: { startsAt: { lte: now } } }] });
  if (view === "draft") and.push({ status: "DRAFT" });
  if (view === "scheduled") and.push({ dropId: { not: null }, drop: { startsAt: { gt: now }, cancelledAt: null } });
  if (view === "sold") and.push({ stock: 0 });
  if (view === "hidden") and.push({ status: "HIDDEN" });
  if (q) and.push({ OR: [{ title: { contains: q } }, { brand: { contains: q } }, { slug: { contains: q } }] });
  if (categoryId) and.push({ categoryId });
  const where: Prisma.ProductWhereInput = { AND: and };

  const [products, total, categories, drafts] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: PAGE,
      skip: (page - 1) * PAGE,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { key: true } },
        category: { select: { name: true } },
        drop: { select: { name: true, startsAt: true, cancelledAt: true } },
      },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.product.count({ where: { status: "DRAFT" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (patch: Record<string, string>) => {
    const params = new URLSearchParams({ ...(view !== "all" ? { view } : {}), ...(q ? { q } : {}), ...(categoryId ? { category: categoryId } : {}), ...patch });
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
    const s = params.toString();
    return s ? `/admin/products?${s}` : "/admin/products";
  };

  return (
    <>
      <PageHeader
        title="Pieces"
        subtitle={`${total} shown · ${drafts} draft${drafts === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/admin/products/new" className="btn btn-ink">
              Add a piece
            </Link>
            <a href="/api/admin/products/export" className="btn btn-line">
              Export CSV
            </a>
          </>
        }
      />
      <nav aria-label="Views" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={link({ view: v === "all" ? "" : v, page: "" })} className={`chip shrink-0 px-3 py-1.5 ${view === v ? "chip-solid" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>
      <form method="get" className="mb-5 flex flex-wrap gap-2">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <input name="q" defaultValue={q} placeholder="Search title, brand or slug" aria-label="Search pieces" className="field min-w-0 flex-1" />
        <select name="category" defaultValue={categoryId} aria-label="Category" className="field w-auto">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ink">
          Filter
        </button>
      </form>

      <ProductsList
        categories={categories}
        products={products.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          size: p.size,
          stock: p.stock,
          status: p.status,
          imageKey: p.images[0]?.key ?? null,
          category: p.category?.name ?? null,
          dropName: p.drop && !p.drop.cancelledAt && p.drop.startsAt > now ? p.drop.name : null,
          state: shopperState(p, now),
        }))}
      />

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={link({ page: String(page - 1) })} className="btn btn-line btn-sm">
              Previous
            </Link>
          )}
          <span className="tag-text text-sm">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={link({ page: String(page + 1) })} className="btn btn-line btn-sm">
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
