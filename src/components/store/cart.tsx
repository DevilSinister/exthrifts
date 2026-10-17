"use client";

// The cart lives in this browser only (localStorage) and holds product ids.
// It reserves nothing: a piece is sold to whoever completes checkout first.
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "ext_cart_v1";
const MAX_LINES = 20;

export interface CartLine {
  productId: string;
  quantity: number;
}

interface CartApi {
  lines: CartLine[];
  ready: boolean;
  count: number;
  has: (productId: string) => boolean;
  add: (productId: string) => void;
  remove: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartApi | null>(null);

function read(): CartLine[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l) => typeof l?.productId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0)
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* private mode or storage full: the cart still works for this page view */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate from storage after mount; the server render always has an empty cart.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(read());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLines(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: (prev: CartLine[]) => CartLine[]) => {
    setLines((prev) => {
      const value = next(prev).slice(0, MAX_LINES);
      write(value);
      return value;
    });
  }, []);

  const api = useMemo<CartApi>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      has: (id) => lines.some((l) => l.productId === id),
      add: (id) => update((prev) => (prev.some((l) => l.productId === id) ? prev : [...prev, { productId: id, quantity: 1 }])),
      remove: (id) => update((prev) => prev.filter((l) => l.productId !== id)),
      setQuantity: (id, quantity) =>
        update((prev) => prev.map((l) => (l.productId === id ? { ...l, quantity: Math.max(1, Math.min(quantity, 5)) } : l))),
      clear: () => update(() => []),
    }),
    [lines, ready, update],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/cart" className="btn btn-ghost btn-sm relative px-2.5" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M5 8h14l-1.2 12H6.2L5 8Z" strokeLinejoin="round" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {ready && count > 0 && (
        <span className="tag-text absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.6875rem] font-bold leading-5 text-paper">
          {count}
        </span>
      )}
    </Link>
  );
}

export function AddToCartButton({ productId, available }: { productId: string; available: boolean }) {
  const cart = useCart();
  const inCart = cart.has(productId);
  if (!available) {
    return (
      <button type="button" className="btn btn-line w-full" disabled>
        Sold
      </button>
    );
  }
  if (inCart) {
    return (
      <Link href="/cart" className="btn btn-line w-full">
        In your cart — check out
      </Link>
    );
  }
  return (
    <button type="button" className="btn btn-ink w-full" onClick={() => cart.add(productId)} disabled={!cart.ready}>
      Add to cart
    </button>
  );
}
