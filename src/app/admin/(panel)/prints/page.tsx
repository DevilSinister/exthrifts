import Link from "next/link";
import { PrintNewButton } from "@/components/admin/PrintButtons";
import { Empty, PageHeader, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { pageCount } from "@/lib/pdf/slips";
import { formatOrderNumber } from "@/lib/site";

export const metadata = { title: "Print history" };

export default async function PrintsPage() {
  await requireAdmin();
  const [batches, pending] = await Promise.all([
    db.printBatch.findMany({
      orderBy: { id: "desc" },
      take: 50,
      include: { createdBy: { select: { name: true } }, orders: { select: { id: true, number: true }, orderBy: { number: "asc" } } },
    }),
    db.order.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Print history"
        subtitle="Every batch of parcel slips: A4 landscape, four per page, cut along the dashed lines. Download any batch again here."
        actions={<PrintNewButton count={pending} />}
      />
      {batches.length ? (
        <ul className="flex flex-col gap-2">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-card p-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  Batch #{b.id} · {b.orders.length} slip{b.orders.length === 1 ? "" : "s"} · {pageCount(b.orders.length)} page
                  {pageCount(b.orders.length) === 1 ? "" : "s"}
                </p>
                <p className="tag-text text-xs text-muted">
                  {pkDateTime.format(b.createdAt)}
                  {b.createdBy ? ` · ${b.createdBy.name}` : ""}
                </p>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  {b.orders.slice(0, 12).map((o) => (
                    <Link key={o.id} href={`/admin/orders/${o.id}`} className="chip chip-muted hover:border-ink hover:text-ink">
                      {formatOrderNumber(o.number)}
                    </Link>
                  ))}
                  {b.orders.length > 12 && <span className="chip chip-muted">+{b.orders.length - 12}</span>}
                </p>
              </div>
              {b.orders.length > 0 && (
                <a href={`/api/admin/print-batches/${b.id}/pdf`} className="btn btn-line btn-sm" download>
                  Download PDF
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No slips printed yet.</Empty>
      )}
    </>
  );
}
