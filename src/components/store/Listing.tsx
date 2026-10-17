import Link from "next/link";
import { ProductGrid } from "@/components/store/ProductCard";
import { filterOptions, listProducts, type ListFilters } from "@/lib/catalog/queries";

type Search = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const num = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
};

export function parseListSearch(sp: Search): ListFilters {
  const sort = one(sp.sort);
  return {
    q: one(sp.q)?.slice(0, 80),
    size: one(sp.size),
    brand: one(sp.brand),
    minCondition: num(sp.condition),
    minPrice: num(sp.min),
    maxPrice: num(sp.max),
    availableOnly: one(sp.available) === "1",
    sort: sort === "price-asc" || sort === "price-desc" ? sort : "new",
    page: num(sp.page) ?? 1,
  };
}

function pageHref(basePath: string, sp: Search, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = one(value);
    if (v && key !== "page" && key !== "focus") params.set(key, v);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export async function Listing({
  title,
  intro,
  basePath,
  searchParams,
  scope,
}: {
  title: string;
  intro?: string | null;
  basePath: string;
  searchParams: Search;
  scope: Pick<ListFilters, "category" | "collection">;
}) {
  const filters = { ...parseListSearch(searchParams), ...scope };
  const [result, options] = await Promise.all([listProducts(filters), filterOptions(scope.category)]);
  const active = [filters.q, filters.size, filters.brand, filters.minCondition, filters.minPrice, filters.maxPrice, filters.availableOnly].filter(Boolean).length;
  const autoFocusSearch = one(searchParams.focus) === "search";

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-2">
        <h1 className="display text-5xl sm:text-6xl">{title}</h1>
        {intro && <p className="max-w-2xl text-ink-soft">{intro}</p>}
      </header>

      <form method="get" action={basePath} className="mb-8 flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Search brand, band, team, era…"
            className="field"
            autoFocus={autoFocusSearch}
          />
          <button type="submit" className="btn btn-ink">
            Go
          </button>
        </div>
        <details className="group border-2 border-ink bg-card" open={active > 0}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 label">
            <span>
              Filter &amp; sort{active ? ` (${active})` : ""}
            </span>
            <span aria-hidden className="transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-4 border-t-2 border-dashed border-ink p-4 sm:grid-cols-2 lg:grid-cols-6">
            <label className="flex flex-col gap-1 text-sm">
              <span className="label">Size</span>
              <select name="size" defaultValue={filters.size ?? ""} className="field">
                <option value="">Any size</option>
                {options.sizes.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="label">Brand</span>
              <select name="brand" defaultValue={filters.brand ?? ""} className="field">
                <option value="">Any brand</option>
                {options.brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="label">Condition</span>
              <select name="condition" defaultValue={filters.minCondition ? String(filters.minCondition) : ""} className="field">
                <option value="">Any</option>
                <option value="9">9/10 and up</option>
                <option value="8">8/10 and up</option>
                <option value="7">7/10 and up</option>
              </select>
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="label">Price (Rs)</span>
              <div className="flex gap-2">
                <input name="min" inputMode="numeric" defaultValue={filters.minPrice} placeholder="Min" aria-label="Minimum price" className="field" />
                <input name="max" inputMode="numeric" defaultValue={filters.maxPrice} placeholder="Max" aria-label="Maximum price" className="field" />
              </div>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="label">Sort</span>
              <select name="sort" defaultValue={filters.sort} className="field">
                <option value="new">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="available" value="1" defaultChecked={filters.availableOnly} className="size-5 accent-ink" />
                Hide sold
              </label>
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
              <button type="submit" className="btn btn-ink">
                Apply
              </button>
              {active > 0 && (
                <Link href={basePath} className="btn btn-line">
                  Clear
                </Link>
              )}
            </div>
          </div>
        </details>
      </form>

      <p className="tag-text mb-4 text-sm text-muted">
        {result.total} piece{result.total === 1 ? "" : "s"}
        {filters.availableOnly ? "" : " · sold pieces stay up for 7 days"}
      </p>

      {result.items.length ? (
        <ProductGrid items={result.items} priorityCount={4} />
      ) : (
        <div className="border-2 border-dashed border-rule p-10 text-center">
          <p className="display text-3xl">Nothing on this rack</p>
          <p className="mt-2 text-muted">
            {active ? "Try fewer filters." : "New pieces are tagged every week."}{" "}
            <Link href="/shop" className="underline underline-offset-4">
              See everything
            </Link>
          </p>
        </div>
      )}

      {result.pages > 1 && (
        <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-2">
          {result.page > 1 && (
            <Link href={pageHref(basePath, searchParams, result.page - 1)} className="btn btn-line btn-sm" rel="prev">
              Previous
            </Link>
          )}
          <span className="tag-text px-3 text-sm">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages && (
            <Link href={pageHref(basePath, searchParams, result.page + 1)} className="btn btn-line btn-sm" rel="next">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
