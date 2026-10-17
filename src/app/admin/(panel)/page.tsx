import Link from "next/link";
import { Panel, StatusChip, pkDateTime } from "@/components/admin/ui";
import { PrintNewButton } from "@/components/admin/PrintButtons";
import { requireAdmin } from "@/lib/auth";
import { buyableWhere, soldCutoff } from "@/lib/catalog/visibility";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { formatOrderNumber } from "@/lib/site";
import type { OrderStatusName } from "@/lib/orders/transitions";

export const metadata = { title: "Dashboard" };

const PKT_OFFSET = 5 * 3_600_000;
const DAY = 86_400_000;

/** Midnight in Pakistan for the given instant, as a UTC Date. */
function pktMidnight(d: Date): Date {
  const local = new Date(d.getTime() + PKT_OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - PKT_OFFSET);
}

const COUNTED = { notIn: ["CANCELLED", "RETURNED"] as OrderStatusName[] };

export default async function Dashboard() {
  await requireAdmin();
  const now = new Date();
  const today = pktMidnight(now);
  const since30 = new Date(today.getTime() - 29 * DAY);

  const [pending, processing, todayAgg, liveCount, soldWeek, recentOrders, recentSold, last30, upcomingDrop] = await Promise.all([
    db.order.count({ where: { status: "PENDING" } }),
    db.order.count({ where: { status: "PROCESSING" } }),
    db.order.aggregate({ where: { createdAt: { gte: today }, status: COUNTED }, _count: true, _sum: { total: true } }),
    db.product.count({ where: buyableWhere(now) }),
    db.product.count({ where: { soldAt: { gte: soldCutoff(now) } } }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, number: true, customerName: true, city: true, total: true, status: true, createdAt: true },
    }),
    db.product.findMany({ where: { soldAt: { not: null } }, orderBy: { soldAt: "desc" }, take: 5, select: { id: true, title: true, price: true, soldAt: true } }),
    db.order.findMany({ where: { createdAt: { gte: since30 }, status: COUNTED }, select: { createdAt: true, total: true } }),
    db.drop.findFirst({ where: { cancelledAt: null, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { id: true, name: true, startsAt: true, _count: { select: { products: true } } } }),
  ]);

  // 30 daily buckets in Pakistan time.
  const buckets = Array.from({ length: 30 }, (_, i) => ({ start: since30.getTime() + i * DAY, total: 0, count: 0 }));
  for (const o of last30) {
    const index = Math.floor((o.createdAt.getTime() - since30.getTime()) / DAY);
    if (buckets[index]) {
      buckets[index].total += o.total;
      buckets[index].count += 1;
    }
  }
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const revenue30 = buckets.reduce((s, b) => s + b.total, 0);
  const orders30 = buckets.reduce((s, b) => s + b.count, 0);
  const dayLabel = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 border-2 border-ink bg-ink p-5 text-paper sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="label text-paper/70">To pack</p>
          <h1 className="display mt-1 text-5xl">
            {pending} new order{pending === 1 ? "" : "s"}
          </h1>
          <p className="mt-1 text-sm text-paper/80">
            {processing} already printed and waiting for the courier.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintNewButton count={pending} inverted />
          <Link href="/admin/orders?status=PENDING" className="btn border-paper text-paper hover:bg-paper hover:text-ink">
            Open orders
          </Link>
        </div>
      </section>

      <dl className="tag-text grid grid-cols-2 border-2 border-ink bg-card text-sm sm:grid-cols-4">
        {[
          ["Today", `${todayAgg._count} order${todayAgg._count === 1 ? "" : "s"}`, formatRs(todayAgg._sum.total ?? 0)],
          ["Last 30 days", `${orders30} orders`, formatRs(revenue30)],
          ["On the rack", `${liveCount} pieces`, "available now"],
          ["Sold this week", `${soldWeek} pieces`, "still shown with SOLD"],
        ].map(([label, main, sub], i) => (
          <div key={label} className={`p-4 ${i % 2 ? "border-l-2 border-dashed border-ink" : ""} ${i > 1 ? "border-t-2 border-dashed border-ink sm:border-t-0" : ""} ${i === 2 ? "sm:border-l-2" : ""}`}>
            <dt className="label font-sans text-muted">{label}</dt>
            <dd className="mt-1 text-lg font-bold">{main}</dd>
            <dd className="text-muted">{sub}</dd>
          </div>
        ))}
      </dl>

      {upcomingDrop && (
        <Link href={`/admin/drops/${upcomingDrop.id}`} className="flex items-center justify-between gap-4 border-2 border-dashed border-ink bg-card p-4 hover:bg-sunken">
          <span>
            <span className="label text-muted">Next drop</span>
            <span className="block font-semibold">
              {upcomingDrop.name} · {upcomingDrop._count.products} pieces
            </span>
          </span>
          <span className="tag-text text-sm">{pkDateTime.format(upcomingDrop.startsAt)}</span>
        </Link>
      )}

      <Panel title="Sales, last 30 days">
        <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Sales for the last 30 days, total ${formatRs(revenue30)}`}>
          {buckets.map((b) => (
            <div key={b.start} className="group relative flex h-full flex-1 items-end">
              <div className="w-full bg-ink" style={{ height: `${Math.max(b.total ? 4 : 1, (b.total / max) * 100)}%`, opacity: b.total ? 1 : 0.15 }} />
              <span className="tag-text pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 py-0.5 text-xs text-paper group-hover:block">
                {dayLabel.format(new Date(b.start))}: {formatRs(b.total)}
              </span>
            </div>
          ))}
        </div>
        <div className="tag-text mt-2 flex justify-between text-xs text-muted">
          <span>{dayLabel.format(since30)}</span>
          <span>Today</span>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Latest orders" actions={<Link href="/admin/orders" className="label underline underline-offset-4">All</Link>}>
          {recentOrders.length ? (
            <ul className="-my-2 divide-y divide-dashed divide-rule">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-sunken">
                    <span className="min-w-0">
                      <span className="tag-text text-sm font-bold">{formatOrderNumber(o.number)}</span>
                      <span className="block truncate text-sm text-muted">
                        {o.customerName}, {o.city} · {pkDateTime.format(o.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <StatusChip status={o.status} />
                      <span className="tag-text text-sm">{formatRs(o.total)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No orders yet. They&apos;ll appear here — and on your phone — the moment they&apos;re placed.</p>
          )}
        </Panel>
        <Panel title="Recently sold">
          {recentSold.length ? (
            <ul className="-my-2 divide-y divide-dashed divide-rule">
              {recentSold.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/admin/products/${p.id}`} className="min-w-0 truncate hover:underline">
                    {p.title}
                  </Link>
                  <span className="tag-text shrink-0 text-muted">{p.soldAt ? pkDateTime.format(p.soldAt) : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing sold yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
