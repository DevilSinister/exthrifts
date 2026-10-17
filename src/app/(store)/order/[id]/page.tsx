import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { STATUS_LABEL, type OrderStatusName } from "@/lib/orders/transitions";
import { getSettings } from "@/lib/settings";
import { formatOrderNumber } from "@/lib/site";

export const metadata: Metadata = { title: "Order placed", robots: { index: false, follow: false } };

export default async function OrderPlacedPage({ params }: PageProps<"/order/[id]">) {
  const { id } = await params;
  // The id is an unguessable cuid. Even so, this page shows no address and only
  // the last digits of the phone number.
  const [order, settings] = await Promise.all([
    db.order.findUnique({
      where: { id },
      select: {
        number: true,
        customerName: true,
        phone: true,
        city: true,
        status: true,
        subtotal: true,
        discount: true,
        shipping: true,
        total: true,
        items: { select: { title: true, size: true, price: true, quantity: true } },
      },
    }),
    getSettings(),
  ]);
  if (!order) notFound();
  const label = formatOrderNumber(order.number);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <div className="relative border-2 border-ink bg-card p-6 shadow-[5px_6px_0_rgba(13,13,12,0.9)] sm:p-8">
        <span className="stamp absolute right-5 top-5 text-xl">Ordered</span>
        <p className="label text-muted">Order {label}</p>
        <h1 className="display mt-2 text-5xl">Thanks, {order.customerName.split(" ")[0]}</h1>
        <p className="mt-4 leading-relaxed text-ink-soft">
          Your order is in. We&apos;ll pack it and send it to {order.city}. The rider will call the number ending in{" "}
          <span className="tag-text font-bold">{order.phone.slice(-3)}</span> and collect{" "}
          <span className="tag-text font-bold">{formatRs(order.total)}</span> in cash. {settings.shipping.deliveryText}
        </p>

        <hr className="tear-ink my-6" />

        <ul className="tag-text flex flex-col gap-2 text-[0.9375rem]">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {item.quantity > 1 ? `${item.quantity} × ` : ""}
                {item.title}
                {item.size ? ` (${item.size})` : ""}
              </span>
              <span>{formatRs(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="tag-text mt-4 flex flex-col gap-1 border-t-2 border-dashed border-rule pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Delivery</dt>
            <dd>{order.shipping ? formatRs(order.shipping) : "Free"}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Discount</dt>
              <dd>−{formatRs(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <dt>Total (COD)</dt>
            <dd>{formatRs(order.total)}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm">
          Status: <span className="chip">{STATUS_LABEL[order.status as OrderStatusName]}</span>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/track" className="btn btn-line">
          Track this order
        </Link>
        <Link href="/shop" className="btn btn-ink">
          Keep browsing
        </Link>
      </div>
      <p className="mt-4 text-sm text-muted">Save your order number: {label}. You&apos;ll need it with your phone number to track the parcel.</p>
    </div>
  );
}
