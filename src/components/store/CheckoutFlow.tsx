"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { inspectCartAction, placeOrderAction, quoteAction, type Quote } from "@/app/(store)/actions";
import { useCart, type CartLine } from "@/components/store/cart";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs } from "@/lib/money";

type CartItem = Awaited<ReturnType<typeof inspectCartAction>>[number];

/** Loads live details (price, availability) for the browser cart. Changes nothing on the server. */
function useCartDetails(couponCode: string) {
  const cart = useCart();
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const key = cart.lines.map((l) => `${l.productId}:${l.quantity}`).join(",");

  useEffect(() => {
    if (!cart.ready) return;
    let cancelled = false;
    (async () => {
      const [details, q] = await Promise.all([
        inspectCartAction(cart.lines.map((l) => l.productId)),
        quoteAction(cart.lines, couponCode || undefined),
      ]);
      if (cancelled) return;
      setItems(details);
      setQuote(q);
    })().catch(() => {
      if (!cancelled) setItems([]);
    });
    return () => {
      cancelled = true;
    };
    // `key` captures the cart contents; re-run only when they or the code change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready, key, couponCode, nonce]);

  const ordered = useMemo(() => {
    if (!items) return null;
    return cart.lines
      .map((line) => ({ line, item: items.find((i) => i.id === line.productId) }))
      .filter((x): x is { line: CartLine; item: CartItem } => Boolean(x.item));
  }, [items, cart.lines]);

  return { cart, items: ordered, quote, refresh };
}

function Summary({ quote, compact = false }: { quote: Quote | null; compact?: boolean }) {
  if (!quote) return <div className="h-32 animate-pulse bg-sunken" aria-hidden />;
  const rows: Array<[string, string]> = [
    ["Subtotal", formatRs(quote.subtotal)],
    ...(quote.discount ? ([[`Discount${quote.couponCode ? ` (${quote.couponCode})` : ""}`, `−${formatRs(quote.discount)}`]] as Array<[string, string]>) : []),
    ["Delivery", quote.subtotal === 0 ? "—" : quote.shipping ? formatRs(quote.shipping) : "Free"],
  ];
  return (
    <dl className={`tag-text flex flex-col gap-1.5 ${compact ? "text-sm" : ""}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      <div className="mt-2 flex justify-between gap-4 border-t-2 border-dashed border-ink pt-3 text-lg font-bold">
        <dt>Total (cash on delivery)</dt>
        <dd>{formatRs(quote.total)}</dd>
      </div>
    </dl>
  );
}

function LineRow({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  return (
    <li className={`flex gap-4 py-4 ${item.available ? "" : "opacity-80"}`}>
      <Link href={`/products/${item.slug}`} className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden border-2 border-ink bg-sunken">
        {item.imageKey && <Image src={mediaSrc(item.imageKey)} alt={item.imageAlt} fill sizes="80px" className={`object-cover ${item.available ? "" : "grayscale"}`} />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/products/${item.slug}`} className="font-semibold leading-snug hover:underline">
          {item.title}
        </Link>
        <p className="tag-text text-sm text-muted">{[item.size, formatRs(item.price)].filter(Boolean).join(" · ")}</p>
        {!item.available && (
          <p className="text-sm font-bold" role="alert">
            Sold to someone else. Remove it to check out.
          </p>
        )}
      </div>
      <button type="button" onClick={onRemove} className="btn btn-ghost btn-sm self-start" aria-label={`Remove ${item.title}`}>
        Remove
      </button>
    </li>
  );
}

export function CartView() {
  const { cart, items, quote } = useCartDetails("");
  if (!cart.ready || items === null) return <div className="h-48 animate-pulse bg-sunken" aria-label="Loading cart" />;
  if (!items.length) {
    return (
      <div className="border-2 border-dashed border-rule p-10 text-center">
        <p className="display text-3xl">Nothing in here yet</p>
        <Link href="/shop" className="btn btn-ink mt-5">
          Browse the rack
        </Link>
      </div>
    );
  }
  const blocked = items.some((x) => !x.item.available);
  return (
    <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
      <ul className="divide-y-2 divide-dashed divide-rule border-y-2 border-ink">
        {items.map(({ item }) => (
          <LineRow key={item.id} item={item} onRemove={() => cart.remove(item.id)} />
        ))}
      </ul>
      <aside className="flex flex-col gap-4 self-start border-2 border-ink bg-card p-5">
        <Summary quote={quote} />
        <Link
          href={blocked ? "#" : "/checkout"}
          aria-disabled={blocked}
          className={`btn btn-ink w-full ${blocked ? "pointer-events-none border-dashed opacity-55" : ""}`}
        >
          Check out
        </Link>
        <p className="text-sm text-muted">Your cart doesn&apos;t hold these pieces. The first person to check out gets them.</p>
      </aside>
    </div>
  );
}

interface FormState {
  customerName: string;
  phone: string;
  email: string;
  city: string;
  otherCity: string;
  address: string;
  notes: string;
}

const EMPTY: FormState = { customerName: "", phone: "", email: "", city: "", otherCity: "", address: "", notes: "" };

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label text-[0.8125rem]">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm font-bold" role="alert">
          ! {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutView({ cities }: { cities: readonly string[] }) {
  const router = useRouter();
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const { cart, items, quote, refresh } = useCartDetails(appliedCoupon);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  if (!cart.ready || items === null) return <div className="h-64 animate-pulse bg-sunken" aria-label="Loading checkout" />;
  if (!items.length) {
    return (
      <div className="border-2 border-dashed border-rule p-10 text-center">
        <p className="display text-3xl">Your cart is empty</p>
        <Link href="/shop" className="btn btn-ink mt-5">
          Browse the rack
        </Link>
      </div>
    );
  }

  const soldItems = items.filter((x) => !x.item.available);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const city = form.city === "Other" ? form.otherCity.trim() : form.city;
    if (!city) {
      setErrors({ city: "Choose your city." });
      return;
    }
    startTransition(async () => {
      const result = await placeOrderAction({
        items: cart.lines,
        customerName: form.customerName,
        phone: form.phone,
        email: form.email,
        city,
        address: form.address,
        notes: form.notes || undefined,
        couponCode: appliedCoupon || undefined,
      });
      if (result.ok) {
        cart.clear();
        router.push(`/order/${result.orderId}`);
        return;
      }
      setFormError(result.error);
      setErrors(result.fieldErrors ?? {});
      // Re-check availability so pieces that just sold are marked in the list.
      if (result.soldIds?.length) refresh();
    });
  }

  const err = (k: string) => errors[k];
  const invalid = (k: string) => (errors[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});

  return (
    <form method="post" onSubmit={submit} className="grid gap-10 md:grid-cols-[1.4fr_1fr]" noValidate>
      <div className="flex flex-col gap-5">
        <fieldset className="flex min-w-0 flex-col gap-4">
          <legend className="display mb-3 text-3xl">Deliver to</legend>
          <Field id="customerName" label="Full name" error={err("customerName")}>
            <input id="customerName" autoComplete="name" className="field" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} {...invalid("customerName")} required />
          </Field>
          <Field id="phone" label="Mobile number" error={err("phone")} hint="The rider calls this number. Format: 0300 1234567">
            <input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="03XX XXXXXXX" className="field tag-text" value={form.phone} onChange={(e) => set("phone", e.target.value)} {...invalid("phone")} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="city" label="City" error={err("city")}>
              <select id="city" className="field" value={form.city} onChange={(e) => set("city", e.target.value)} {...invalid("city")} required>
                <option value="">Choose city</option>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
                <option value="Other">Other city or town</option>
              </select>
            </Field>
            {form.city === "Other" && (
              <Field id="otherCity" label="Your city or town">
                <input id="otherCity" autoComplete="address-level2" className="field" value={form.otherCity} onChange={(e) => set("otherCity", e.target.value)} required />
              </Field>
            )}
          </div>
          <Field id="address" label="Full address" error={err("address")} hint="House, street, area and a landmark. Please write it in English.">
            <textarea id="address" autoComplete="street-address" rows={3} className="field" value={form.address} onChange={(e) => set("address", e.target.value)} {...invalid("address")} required />
          </Field>
          <Field id="email" label="Email (optional)" error={err("email")}>
            <input id="email" type="email" autoComplete="email" className="field" value={form.email} onChange={(e) => set("email", e.target.value)} {...invalid("email")} />
          </Field>
          <Field id="notes" label="Note for us (optional)" error={err("notes")}>
            <input id="notes" className="field" placeholder="e.g. call before coming" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </fieldset>
      </div>

      <aside className="flex flex-col gap-5 self-start border-2 border-ink bg-card p-5 md:sticky md:top-28">
        <h2 className="display text-3xl">Your order</h2>
        <ul className="flex flex-col gap-3">
          {items.map(({ item }) => (
            <li key={item.id} className="flex items-center gap-3">
              <div className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden bg-sunken">
                {item.imageKey && <Image src={mediaSrc(item.imageKey)} alt="" fill sizes="48px" className={`object-cover ${item.available ? "" : "grayscale"}`} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="tag-text text-xs text-muted">{item.available ? [item.size, formatRs(item.price)].filter(Boolean).join(" · ") : "Just sold"}</p>
              </div>
              {!item.available && (
                <button type="button" className="btn btn-line btn-sm" onClick={() => cart.remove(item.id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="coupon" className="label text-[0.8125rem]">
            Discount code
          </label>
          <div className="flex gap-2">
            <input
              id="coupon"
              className="field tag-text uppercase"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              autoComplete="off"
              {...invalid("couponCode")}
            />
            <button type="button" className="btn btn-line" onClick={() => setAppliedCoupon(couponInput.trim())} disabled={!couponInput.trim()}>
              Apply
            </button>
          </div>
          {(quote?.couponError || err("couponCode")) && (
            <p id="couponCode-error" className="text-sm font-bold" role="alert">
              ! {quote?.couponError ?? err("couponCode")}
            </p>
          )}
          {quote?.couponCode && <p className="tag-text text-sm">Code {quote.couponCode} applied.</p>}
        </div>

        <Summary quote={quote} />

        {formError && (
          <p className="border-2 border-dashed border-ink p-3 text-sm font-bold" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="btn btn-ink w-full" disabled={pending || soldItems.length > 0}>
          {pending ? "Placing order…" : `Place order · ${quote ? formatRs(quote.total) : ""}`}
        </button>
        <p className="text-xs text-muted">
          By placing the order you agree to pay the total in cash when it&apos;s delivered.{" "}
          <Link href="/pages/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </p>
      </aside>
    </form>
  );
}
