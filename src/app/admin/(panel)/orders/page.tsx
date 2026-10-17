import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { OrdersList } from "@/components/admin/OrdersList";
import { PrintNewButton } from "@/components/admin/PrintButtons";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ORDER_STATUSES, STATUS_LABEL, isOrderStatus } from "@/lib/orders/transitions";
import { normalizePkPhone } from "@/lib/phone";
import { parseOrderNumber } from "@/lib/site";

export const metadata = { title: "Orders" };
const PAGE = 50;

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && isOrderStatus(sp.status) ? sp.status : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.OrderWhereInput = { ...(status ? { status } : {}) };
  if (q) {
    const number = parseOrderNumber(q);
    const phone = normalizePkPhone(q);
    where.OR = [
      ...(number ? [{ number }] : []),
      ...(phone ? [{ phone }] : []),
      { customerName: { contains: q } },
      { city: { contains: q } },
    ];
  }

  const [orders, total, counts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      take: PAGE,
      skip: (page - 1) * PAGE,
      select: {
        id: true,
        number: true,
        customerName: true,
        phone: true,
        city: true,
        total: true,
        status: true,
        createdAt: true,
        printedAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pending = countOf("PENDING");
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={status === "PENDING" ? "Oldest first, so the longest-waiting parcel is packed first." : undefined}
        actions={
          <>
            <PrintNewButton count={pending} />
            <a href={`/api/admin/orders/export${status ? `?status=${status}` : ""}`} className="btn btn-line">
              Export CSV
            </a>
          </>
        }
      />

      <nav aria-label="Filter by status" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Link href={qs({ status: null, page: null })} className={`chip shrink-0 px-3 py-1.5 ${!status ? "chip-solid" : ""}`} aria-current={!status ? "page" : undefined}>
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={qs({ status: s, page: null })}
            className={`chip shrink-0 px-3 py-1.5 ${status === s ? "chip-solid" : ""}`}
            aria-current={status === s ? "page" : undefined}
          >
            {STATUS_LABEL[s]} <span className="tag-text">{countOf(s)}</span>
          </Link>
        ))}
      </nav>

      <form method="get" className="mb-5 flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="order-search" className="sr-only">
          Search orders
        </label>
        <input id="order-search" name="q" defaultValue={q} placeholder="Order no., phone, name or city" className="field" />
        <button className="btn btn-ink" type="submit">
          Search
        </button>
      </form>

      <OrdersList
        orders={orders.map((o) => ({
          id: o.id,
          number: o.number,
          customerName: o.customerName,
          phone: o.phone,
          city: o.city,
          total: o.total,
          status: o.status,
          createdAt: o.createdAt.toISOString(),
          printed: Boolean(o.printedAt),
          items: o._count.items,
        }))}
      />

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link href={qs({ page: String(page - 1) })} className="btn btn-line btn-sm">
              Previous
            </Link>
          )}
          <span className="tag-text text-sm">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={qs({ page: String(page + 1) })} className="btn btn-line btn-sm">
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
