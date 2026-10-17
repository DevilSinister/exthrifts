import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addNoteAction, changeStatusAction, updateDeliveryAction } from "@/app/admin/actions/orders";
import { ActionForm, F } from "@/components/admin/ActionForm";
import { PrintOneButton } from "@/components/admin/PrintButtons";
import { PageHeader, Panel, StatusChip, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { COURIERS } from "@/lib/couriers";
import { db } from "@/lib/db";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs } from "@/lib/money";
import { STATUS_LABEL, nextStatuses, restocksOn } from "@/lib/orders/transitions";
import { displayPhone, whatsappLink } from "@/lib/phone";
import { formatOrderNumber, site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/admin/orders/[id]">) {
  const order = await db.order.findUnique({ where: { id: (await params).id }, select: { number: true } });
  return { title: order ? formatOrderNumber(order.number) : "Order" };
}

export default async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const order = await db.order.findUnique({
    where: { id: (await params).id },
    include: {
      items: { include: { product: { select: { id: true, slug: true } } } },
      events: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } },
      printBatch: { select: { id: true } },
    },
  });
  if (!order) notFound();
  const label = formatOrderNumber(order.number);
  const next = nextStatuses(order.status);
  const closed = next.length === 0;
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
  const firstName = order.customerName.split(" ")[0];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={label}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={order.status} /> Placed {pkDateTime.format(order.createdAt)}
            {order.printBatch && (
              <Link href="/admin/prints" className="chip chip-muted">
                slip batch #{order.printBatch.id}
              </Link>
            )}
          </span>
        }
        actions={!closed && <PrintOneButton orderId={order.id} label={order.status === "PENDING" ? "Print slip" : "Reprint slip"} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title="Deliver to">
            <p className="text-lg font-semibold">{order.customerName}</p>
            <p className="tag-text mt-1 text-lg">{displayPhone(order.phone)}</p>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{order.address}</p>
            <p className="label mt-1 text-sm">{order.city}</p>
            {order.email && <p className="mt-2 text-sm text-muted">{order.email}</p>}
            {order.notes && <p className="mt-3 border-2 border-dashed border-ink p-2 text-sm">Customer note: {order.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:${order.phone}`} className="btn btn-line btn-sm">
                Call
              </a>
              <a
                href={whatsappLink(order.phone, `Hi ${firstName}, this is ${site.name} about your order ${label}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-line btn-sm"
              >
                WhatsApp
              </a>
            </div>
            {!closed && (
              <details className="mt-4 border-t-2 border-dashed border-rule pt-3">
                <summary className="label cursor-pointer">Edit delivery details</summary>
                <ActionForm action={updateDeliveryAction} className="mt-3" submitLabel="Save details">
                  <input type="hidden" name="orderId" value={order.id} />
                  <F label="Name">
                    <input name="customerName" defaultValue={order.customerName} className="field" />
                  </F>
                  <F label="City">
                    <input name="city" defaultValue={order.city} className="field" />
                  </F>
                  <F label="Address">
                    <textarea name="address" defaultValue={order.address} className="field" rows={3} />
                  </F>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <F label="Courier">
                      <input name="courier" defaultValue={order.courier ?? ""} className="field" list="couriers" />
                    </F>
                    <F label="Tracking no.">
                      <input name="trackingNo" defaultValue={order.trackingNo ?? ""} className="field tag-text" />
                    </F>
                  </div>
                </ActionForm>
              </details>
            )}
          </Panel>

          <Panel title={`${pieces} piece${pieces === 1 ? "" : "s"}`}>
            <ul className="-my-2 divide-y divide-dashed divide-rule">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-3">
                  <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden border-2 border-ink bg-sunken">
                    {item.imageKey && <Image src={mediaSrc(item.imageKey)} alt="" fill sizes="56px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {item.product ? (
                      <Link href={`/admin/products/${item.product.id}`} className="font-semibold hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{item.title}</p>
                    )}
                    <p className="tag-text text-sm text-muted">
                      {[item.size && `Size ${item.size}`, item.quantity > 1 && `× ${item.quantity}`].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="tag-text font-bold">{formatRs(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="tag-text mt-3 flex flex-col gap-1 border-t-2 border-dashed border-ink pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatRs(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Discount {order.couponCode && `(${order.couponCode})`}</dt>
                  <dd>−{formatRs(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Delivery</dt>
                <dd>{order.shipping ? formatRs(order.shipping) : "Free"}</dd>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <dt>Collect (COD)</dt>
                <dd>{formatRs(order.total)}</dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Next step">
            {closed ? (
              <p className="text-sm text-muted">This order is {STATUS_LABEL[order.status].toLowerCase()}. No further steps.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {next.map((to) =>
                  to === "SHIPPED" ? (
                    <ActionForm key={to} action={changeStatusAction} submitLabel="Mark shipped" className="border-2 border-dashed border-ink p-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="to" value={to} />
                      <F label="Courier">
                        <input name="courier" required list="couriers" defaultValue={order.courier ?? ""} className="field" placeholder="e.g. TCS, Leopards" />
                      </F>
                      <F label="Tracking no. (optional)">
                        <input name="trackingNo" defaultValue={order.trackingNo ?? ""} className="field tag-text" />
                      </F>
                    </ActionForm>
                  ) : (
                    <ActionForm
                      key={to}
                      action={changeStatusAction}
                      submitLabel={`Mark ${STATUS_LABEL[to].toLowerCase()}`}
                      submitClassName={restocksOn(to) ? "btn btn-line w-full" : "btn btn-ink w-full"}
                      confirm={restocksOn(to) ? `Mark ${label} ${STATUS_LABEL[to].toLowerCase()}? Its pieces go back on sale.` : undefined}
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="to" value={to} />
                    </ActionForm>
                  ),
                )}
              </div>
            )}
            {(order.courier || order.trackingNo) && (
              <p className="tag-text mt-4 text-sm">
                {order.courier} {order.trackingNo && `· ${order.trackingNo}`}
              </p>
            )}
          </Panel>

          <Panel title="Timeline">
            <ActionForm action={addNoteAction} submitLabel="Add note" submitClassName="btn btn-line btn-sm" resetOnSuccess>
              <input type="hidden" name="orderId" value={order.id} />
              <label className="sr-only" htmlFor="note">
                Internal note
              </label>
              <textarea id="note" name="note" rows={2} className="field" placeholder="Internal note (customers never see this)" />
            </ActionForm>
            <ol className="mt-5 flex flex-col gap-3 border-l-2 border-dashed border-ink pl-4">
              {order.events.map((e) => (
                <li key={e.id} className="relative">
                  <span aria-hidden className={`absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full ${e.type === "note" ? "border-2 border-ink bg-paper" : "bg-ink"}`} />
                  <p className="text-sm font-semibold">
                    {e.type === "status" && e.toStatus ? `${STATUS_LABEL[e.fromStatus!]} → ${STATUS_LABEL[e.toStatus]}` : e.type === "created" ? "Order placed" : e.type === "print" ? "Slip printed" : "Note"}
                  </p>
                  {e.message && e.type !== "created" && <p className="whitespace-pre-line text-sm text-ink-soft">{e.message}</p>}
                  <p className="tag-text text-xs text-muted">
                    {pkDateTime.format(e.createdAt)}
                    {e.actor ? ` · ${e.actor.name}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <datalist id="couriers">
        {COURIERS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
