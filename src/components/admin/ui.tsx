import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL, type OrderStatusName } from "@/lib/orders/transitions";

export const pkDateTime = new Intl.DateTimeFormat("en-PK", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});
export const pkDate = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="label mb-2 inline-flex min-h-8 items-center gap-1 text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Order status as shape, not colour: new = solid, in progress = outline, done = dashed/muted. */
export function StatusChip({ status }: { status: OrderStatusName }) {
  const style: Record<OrderStatusName, string> = {
    PENDING: "chip chip-solid",
    PROCESSING: "chip",
    SHIPPED: "chip chip-dashed",
    DELIVERED: "chip chip-muted",
    CANCELLED: "chip chip-muted line-through",
    RETURNED: "chip chip-muted chip-dashed",
  };
  return <span className={style[status]}>{STATUS_LABEL[status]}</span>;
}

export function Panel({ title, children, actions, className = "" }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`border-2 border-ink bg-card ${className}`}>
      {(title || actions) && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b-2 border-dashed border-ink px-4">
          {title && <h2 className="label">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border-2 border-dashed border-rule p-8 text-center text-muted">{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="mb-4 border-2 border-dashed border-ink bg-card p-3 text-sm">{children}</div>;
}
