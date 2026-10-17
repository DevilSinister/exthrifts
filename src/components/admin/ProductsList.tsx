"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { bulkProductsAction } from "@/app/admin/actions/products";
import { Empty } from "@/components/admin/ui";
import type { ActionState } from "@/lib/admin-action";
import type { ShopperState } from "@/lib/catalog/visibility";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs } from "@/lib/money";

export interface ProductRow {
  id: string;
  title: string;
  price: number;
  size: string | null;
  stock: number;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  imageKey: string | null;
  category: string | null;
  dropName: string | null;
  state: ShopperState;
}

function StateChip({ p }: { p: ProductRow }) {
  if (p.dropName) return <span className="chip chip-dashed">Drop: {p.dropName}</span>;
  if (p.status === "DRAFT") return <span className="chip chip-dashed">Draft</span>;
  if (p.status === "HIDDEN") return <span className="chip chip-muted">Hidden</span>;
  if (p.stock === 0) return <span className="chip chip-muted">Sold</span>;
  return <span className="chip chip-solid">Live</span>;
}

export function ProductsList({ products, categories }: { products: ProductRow[]; categories: Array<{ id: string; name: string }> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [op, setOp] = useState("publish");
  const [state, action, pending] = useActionState<ActionState, FormData>(bulkProductsAction, {});

  // Clear the selection once per successful bulk action (state update during render, not in an effect).
  const [handledAt, setHandledAt] = useState<number | undefined>(undefined);
  if (state.at !== handledAt) {
    setHandledAt(state.at);
    if (state.ok) setSelected([]);
  }

  if (!products.length) {
    return (
      <Empty>
        No pieces here.{" "}
        <Link href="/admin/products/new" className="underline underline-offset-4">
          Add one
        </Link>
      </Empty>
    );
  }
  const all = products.map((p) => p.id);
  const allOn = selected.length === all.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-11 flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-ink" checked={allOn} onChange={() => setSelected(allOn ? [] : all)} />
          {selected.length ? `${selected.length} selected` : "Select all"}
        </label>
        {selected.length > 0 && (
          <form
            action={action}
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              if (op === "delete" && !window.confirm(`Delete ${selected.length} piece(s) and their photos? Ordered pieces are kept.`)) e.preventDefault();
            }}
          >
            {selected.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <select name="op" value={op} onChange={(e) => setOp(e.target.value)} className="field h-9 min-h-0 w-auto py-0 text-sm" aria-label="Bulk action">
              <option value="publish">Publish</option>
              <option value="draft">Move to drafts</option>
              <option value="hide">Hide</option>
              <option value="category">Change category</option>
              <option value="delete">Delete</option>
            </select>
            {op === "category" && (
              <select name="categoryId" className="field h-9 min-h-0 w-auto py-0 text-sm" aria-label="Category">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <button type="submit" className="btn btn-ink btn-sm" disabled={pending}>
              {pending ? "Applying…" : "Apply"}
            </button>
          </form>
        )}
        <span aria-live="polite" className="text-sm">
          {!pending && state.ok && <span className="tag-text">✓ {state.ok}</span>}
          {!pending && state.error && <span className="font-bold">! {state.error}</span>}
        </span>
      </div>

      <ul className="grid gap-2 lg:grid-cols-2">
        {products.map((p) => {
          const on = selected.includes(p.id);
          return (
            <li key={p.id} className={`flex items-stretch border-2 border-ink ${on ? "bg-sunken" : "bg-card"}`}>
              <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center border-r-2 border-dashed border-ink">
                <span className="sr-only">Select {p.title}</span>
                <input type="checkbox" className="size-5 accent-ink" checked={on} onChange={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
              </label>
              <Link href={`/admin/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-2.5 hover:bg-sunken">
                <span className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden bg-sunken">
                  {p.imageKey ? (
                    <Image src={mediaSrc(p.imageKey)} alt="" fill sizes="56px" className={`object-cover ${p.stock === 0 ? "grayscale" : ""}`} />
                  ) : (
                    <span className="grid h-full place-items-center text-[0.625rem] text-muted">no photo</span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold">{p.title}</span>
                  <span className="tag-text truncate text-xs text-muted">
                    {[p.size, p.category, p.stock > 1 ? `${p.stock} in stock` : null].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span className="flex items-center gap-2">
                    <StateChip p={p} />
                    <span className="tag-text text-sm font-bold">{formatRs(p.price)}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
