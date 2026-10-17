"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { bulkStatusAction } from "@/app/admin/actions/orders";
import { PrintSelectedButton } from "@/components/admin/PrintButtons";
import { Empty, StatusChip } from "@/components/admin/ui";
import type { ActionState } from "@/lib/admin-action";
import { COURIERS } from "@/lib/couriers";
import { formatRs } from "@/lib/money";
import { STATUS_LABEL, type OrderStatusName } from "@/lib/orders/transitions";
import { displayPhone } from "@/lib/phone";
import { formatOrderNumber } from "@/lib/site";

export interface OrderRow {
  id: string;
  number: number;
  customerName: string;
  phone: string;
  city: string;
  total: number;
  status: OrderStatusName;
  createdAt: string;
  printed: boolean;
  items: number;
}

const when = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [to, setTo] = useState<OrderStatusName>("SHIPPED");
  const [state, action, pending] = useActionState<ActionState, FormData>(bulkStatusAction, {});

  // Clear the selection once per successful bulk action (state update during render, not in an effect).
  const [handledAt, setHandledAt] = useState<number | undefined>(undefined);
  if (state.at !== handledAt) {
    setHandledAt(state.at);
    if (state.ok) setSelected([]);
  }

  if (!orders.length) return <Empty>No orders match.</Empty>;
  const allIds = orders.map((o) => o.id);
  const allOn = selected.length === allIds.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-11 flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-ink" checked={allOn} onChange={() => setSelected(allOn ? [] : allIds)} />
          {selected.length ? `${selected.length} selected` : "Select all"}
        </label>
        {selected.length > 0 && (
          <>
            <form action={action} className="flex flex-wrap items-center gap-2">
              {selected.map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <label className="sr-only" htmlFor="bulk-to">
                New status
              </label>
              <select id="bulk-to" name="to" value={to} onChange={(e) => setTo(e.target.value as OrderStatusName)} className="field h-9 min-h-0 w-auto py-0 text-sm">
                {(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"] as const).map((s) => (
                  <option key={s} value={s}>
                    Mark {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              {to === "SHIPPED" && (
                <select name="courier" required defaultValue="" className="field h-9 min-h-0 w-auto py-0 text-sm" aria-label="Courier">
                  <option value="" disabled>
                    Courier
                  </option>
                  {COURIERS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                className="btn btn-ink btn-sm"
                disabled={pending}
                onClick={(e) => {
                  if ((to === "CANCELLED" || to === "RETURNED") && !window.confirm(`Mark ${selected.length} order(s) ${STATUS_LABEL[to]}? Their pieces go back on sale.`)) e.preventDefault();
                }}
              >
                {pending ? "Applying…" : "Apply"}
              </button>
            </form>
            <PrintSelectedButton ids={selected} />
          </>
        )}
        <span aria-live="polite" className="text-sm">
          {!pending && state.ok && <span className="tag-text">✓ {state.ok}</span>}
          {!pending && state.error && <span className="font-bold">! {state.error}</span>}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {orders.map((o) => {
          const on = selected.includes(o.id);
          return (
            <li key={o.id} className={`flex items-stretch border-2 border-ink ${on ? "bg-sunken" : "bg-card"}`}>
              <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center border-r-2 border-dashed border-ink">
                <span className="sr-only">Select {formatOrderNumber(o.number)}</span>
                <input
                  type="checkbox"
                  className="size-5 accent-ink"
                  checked={on}
                  onChange={() => setSelected((s) => (on ? s.filter((x) => x !== o.id) : [...s, o.id]))}
                />
              </label>
              <Link href={`/admin/orders/${o.id}`} className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-3 gap-y-1 p-3 hover:bg-sunken lg:grid-cols-[10rem_minmax(0,1fr)_8.5rem_7.5rem_7.5rem] lg:items-center lg:gap-x-6">
                <span className="flex min-w-0 items-center gap-2 lg:col-start-1 lg:row-span-2">
                  <span className="tag-text whitespace-nowrap font-bold">{formatOrderNumber(o.number)}</span>
                  {o.printed && <span className="chip chip-muted">printed</span>}
                </span>
                <span className="justify-self-end lg:col-start-5 lg:row-span-2 lg:row-start-1">
                  <StatusChip status={o.status} />
                </span>
                <span className="min-w-0 truncate text-sm lg:col-start-2 lg:row-start-1 lg:font-semibold">
                  {o.customerName} · {o.city}
                </span>
                <span className="tag-text justify-self-end text-sm font-bold lg:col-start-4 lg:row-span-2 lg:row-start-1">{formatRs(o.total)}</span>
                <span className="tag-text truncate text-xs text-muted lg:col-start-2 lg:row-start-2">
                  {displayPhone(o.phone)} · {o.items} piece{o.items === 1 ? "" : "s"}
                </span>
                <span className="tag-text justify-self-end text-xs text-muted lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:justify-self-start lg:text-sm">{when.format(new Date(o.createdAt))}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
