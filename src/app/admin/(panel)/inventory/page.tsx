import Link from "next/link";
import { adjustStockAction } from "@/app/admin/actions/catalog";
import { ActionForm } from "@/components/admin/ActionForm";
import { Empty, PageHeader, Panel, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const onlyMulti = sp.multi === "1";
  const [products, logs] = await Promise.all([
    db.product.findMany({
      where: {
        status: { not: "HIDDEN" },
        ...(q ? { OR: [{ title: { contains: q } }, { brand: { contains: q } }] } : {}),
        ...(onlyMulti ? { stock: { gt: 1 } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: { id: true, title: true, stock: true, size: true, status: true },
    }),
    db.inventoryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { product: { select: { id: true, title: true } }, actor: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Inventory" subtitle="Most pieces are one of one. Use this for the few you hold more than one of, or to correct a count." />
      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search pieces" aria-label="Search pieces" className="field min-w-0 flex-1" />
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="multi" value="1" defaultChecked={onlyMulti} className="size-5 accent-ink" /> More than 1 in stock
        </label>
        <button type="submit" className="btn btn-ink">
          Filter
        </button>
      </form>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          {products.length ? (
            <ul className="flex flex-col gap-2">
              {products.map((p) => (
                <li key={p.id} className="border-2 border-ink bg-card">
                  <details>
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3">
                      <span className="min-w-0 truncate text-sm font-semibold">{p.title}</span>
                      <span className="tag-text shrink-0 text-sm">
                        {p.size ? `${p.size} · ` : ""}
                        <strong>{p.stock}</strong> in stock
                      </span>
                    </summary>
                    <div className="border-t-2 border-dashed border-ink p-3">
                      <ActionForm action={adjustStockAction} submitLabel="Update stock" resetOnSuccess>
                        <input type="hidden" name="productId" value={p.id} />
                        <div className="grid grid-cols-[auto_6rem] gap-2">
                          <select name="mode" className="field" aria-label="Change">
                            <option value="add">Add</option>
                            <option value="remove">Remove</option>
                            <option value="set">Set to</option>
                          </select>
                          <input name="amount" type="number" min={0} defaultValue={1} className="field tag-text" aria-label="Amount" />
                        </div>
                        <input name="reason" className="field" placeholder="Reason (e.g. found a second one)" aria-label="Reason" />
                      </ActionForm>
                      <Link href={`/admin/products/${p.id}`} className="mt-2 inline-block text-sm underline underline-offset-4">
                        Open piece
                      </Link>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No pieces match.</Empty>
          )}
        </section>
        <Panel title="Recent stock changes">
          <ul className="tag-text flex flex-col gap-2 text-xs">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-col border-b border-dashed border-rule pb-2">
                <Link href={`/admin/products/${log.product.id}`} className="truncate font-sans text-sm font-semibold hover:underline">
                  {log.product.title}
                </Link>
                <span>
                  {log.change > 0 ? `+${log.change}` : log.change} → {log.after} · {log.reason}
                </span>
                <span className="text-muted">
                  {pkDateTime.format(log.createdAt)}
                  {log.actor ? ` · ${log.actor.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
