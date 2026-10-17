import Link from "next/link";
import { Empty, PageHeader, pkDate } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { displayPhone, normalizePkPhone, whatsappLink } from "@/lib/phone";

export const metadata = { title: "Customers" };

/** Customers are grouped by phone number, the one thing every COD order has. */
export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const phone = q ? normalizePkPhone(q) : null;

  const groups = await db.order.groupBy({
    by: ["phone"],
    where: {
      status: { notIn: ["CANCELLED"] },
      ...(q ? (phone ? { phone } : { OR: [{ customerName: { contains: q } }, { city: { contains: q } }] }) : {}),
    },
    _count: { _all: true },
    _sum: { total: true },
    _max: { createdAt: true },
    _min: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 200,
  });
  const latest = await db.order.findMany({
    where: { phone: { in: groups.map((g) => g.phone) } },
    orderBy: { createdAt: "desc" },
    distinct: ["phone"],
    select: { phone: true, customerName: true, city: true },
  });
  const byPhone = new Map(latest.map((l) => [l.phone, l]));

  return (
    <>
      <PageHeader title="Customers" subtitle={`${groups.length} shown · grouped by phone number, cancelled orders left out`} />
      <form method="get" className="mb-5 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Phone, name or city" aria-label="Search customers" className="field" />
        <button type="submit" className="btn btn-ink">
          Search
        </button>
      </form>
      {groups.length ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {groups.map((g) => {
            const info = byPhone.get(g.phone);
            return (
              <li key={g.phone} className="flex items-center justify-between gap-3 border-2 border-ink bg-card p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {info?.customerName} <span className="font-normal text-muted">· {info?.city}</span>
                  </p>
                  <p className="tag-text text-sm">{displayPhone(g.phone)}</p>
                  <p className="tag-text text-xs text-muted">
                    {g._count._all} order{g._count._all === 1 ? "" : "s"} · {formatRs(g._sum.total ?? 0)} · since {g._min.createdAt ? pkDate.format(g._min.createdAt) : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Link href={`/admin/orders?q=${encodeURIComponent(g.phone)}`} className="btn btn-line btn-sm">
                    Orders
                  </Link>
                  <a href={whatsappLink(g.phone)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    WhatsApp
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No customers yet.</Empty>
      )}
    </>
  );
}
