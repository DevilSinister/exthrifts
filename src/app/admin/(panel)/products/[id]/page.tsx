import Link from "next/link";
import { notFound } from "next/navigation";
import { duplicateProductAction, markSoldAction } from "@/app/admin/actions/products";
import { ActionForm } from "@/components/admin/ActionForm";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Notice, PageHeader, Panel, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { asMeasurements } from "@/lib/catalog/queries";
import { shopperState } from "@/lib/catalog/visibility";
import { db } from "@/lib/db";

export const metadata = { title: "Edit piece" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, categories, collections] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        collections: { select: { id: true } },
        drop: { select: { id: true, name: true, startsAt: true, cancelledAt: true } },
        inventoryLogs: { orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true } } } },
        _count: { select: { orderItems: true } },
      },
    }),
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();
  const state = shopperState(product, new Date());
  const pendingDrop = product.drop && !product.drop.cancelledAt && product.drop.startsAt > new Date() ? product.drop : null;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/products", label: "Pieces" }}
        title={product.title}
        subtitle={
          state === "available"
            ? "Live on the site"
            : state === "sold-recent"
              ? "Sold — still shown with SOLD for up to 7 days"
              : state === "sold-archived"
                ? "Sold — no longer listed"
                : pendingDrop
                  ? `Waiting for the drop "${pendingDrop.name}"`
                  : "Not on the site"
        }
        actions={
          <>
            {state !== "hidden" && (
              <Link href={`/products/${product.slug}`} target="_blank" className="btn btn-line">
                View on site
              </Link>
            )}
            <ActionForm action={duplicateProductAction} submitLabel="Duplicate" submitClassName="btn btn-line" inline>
              <input type="hidden" name="id" value={product.id} />
            </ActionForm>
          </>
        }
      />
      {sp.created && <Notice>Piece saved. Keep editing, or add another from Pieces.</Notice>}
      {sp.duplicated && <Notice>This is a copy saved as a draft. Add its own photos before publishing.</Notice>}

      <ProductEditor
        categories={categories}
        collections={collections}
        product={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          description: product.description ?? "",
          status: product.status,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          costPrice: product.costPrice,
          stock: product.stock,
          size: product.size ?? "",
          measurements: asMeasurements(product.measurements) as Record<string, number>,
          conditionGrade: product.conditionGrade,
          conditionNotes: product.conditionNotes ?? "",
          brand: product.brand ?? "",
          era: product.era ?? "",
          tags: Array.isArray(product.tags) ? (product.tags as string[]).join(", ") : "",
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
          categoryId: product.categoryId ?? "",
          collectionIds: product.collections.map((c) => c.id),
          images: product.images.map((i) => ({ key: i.key, alt: i.alt, width: i.width, height: i.height })),
          dropName: pendingDrop?.name ?? null,
        }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Stock history">
          {product.inventoryLogs.length ? (
            <ul className="tag-text flex flex-col gap-1.5 text-sm">
              {product.inventoryLogs.map((log) => (
                <li key={log.id} className="flex justify-between gap-3">
                  <span>
                    {log.change > 0 ? `+${log.change}` : log.change} → {log.after} · {log.reason}
                  </span>
                  <span className="shrink-0 text-muted">{pkDateTime.format(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No stock changes yet.</p>
          )}
        </Panel>
        <Panel title="Sold somewhere else?">
          <p className="mb-3 text-sm text-ink-soft">
            Sold on Instagram or in person? Mark it sold so nobody can order it. {product._count.orderItems > 0 && `It is on ${product._count.orderItems} order(s).`}
          </p>
          {product.stock > 0 ? (
            <ActionForm action={markSoldAction} submitLabel="Mark as sold" submitClassName="btn btn-line" confirm="Mark this piece as sold?">
              <input type="hidden" name="id" value={product.id} />
            </ActionForm>
          ) : (
            <p className="text-sm font-semibold">Already sold out.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
