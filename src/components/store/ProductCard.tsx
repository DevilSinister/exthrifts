import Image from "next/image";
import Link from "next/link";
import type { Measurements, ProductCardData } from "@/lib/catalog/queries";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs } from "@/lib/money";

export function measurementLine(m: Measurements): string | null {
  if (m.chest && m.length) return `${m.chest}×${m.length}″`;
  if (m.waist && m.inseam) return `W${m.waist} L${m.inseam}`;
  if (m.chest) return `chest ${m.chest}″`;
  if (m.waist) return `W${m.waist}`;
  return null;
}

/**
 * A piece on the rack. The hang-tag line under the photo carries the facts a
 * thrift buyer filters by — size, chest × length, condition — so nobody has to
 * open the listing to find out it won't fit.
 */
export function ProductCard({
  product,
  priority = false,
  linkable = true,
}: {
  product: ProductCardData;
  priority?: boolean;
  /** Drop previews show pieces before they can be opened. */
  linkable?: boolean;
}) {
  const sold = product.state === "sold-recent" || product.state === "sold-archived";
  const [first, second] = product.images;
  const facts = [
    product.size,
    measurementLine(product.measurements),
    product.conditionGrade ? `${product.conditionGrade}/10` : null,
  ].filter(Boolean);

  const body = (
    <>
      <div className="relative aspect-[4/5] overflow-hidden bg-sunken">
        {first ? (
          <Image
            src={mediaSrc(first.key)}
            alt={first.alt}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            priority={priority}
            className={`object-cover transition-opacity duration-300 ${sold ? "grayscale opacity-60" : ""}`}
          />
        ) : (
          <div className="grid h-full place-items-center label text-muted">No photo yet</div>
        )}
        {second && !sold && (
          <Image
            src={mediaSrc(second.key)}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {sold && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="stamp bg-paper/80 text-2xl text-ink sm:text-3xl">Sold</span>
          </span>
        )}
        {!sold && product.compareAtPrice && product.compareAtPrice > product.price && (
          <span className="absolute left-2 top-2 rounded-[3px] bg-ink px-1.5 py-0.5 label text-[0.6875rem] text-paper">
            Sale
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 pt-2.5">
        <h3 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug">{product.title}</h3>
        {facts.length > 0 && <p className="tag-text text-[0.8125rem] text-muted">{facts.join(" · ")}</p>}
        <p className="flex items-baseline gap-2">
          <span className={`tag-text text-[0.9375rem] font-bold ${sold ? "line-through decoration-1" : ""}`}>
            {formatRs(product.price)}
          </span>
          {!sold && product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="tag-text text-[0.8125rem] text-muted line-through">{formatRs(product.compareAtPrice)}</span>
          )}
        </p>
      </div>
    </>
  );

  if (!linkable) return <div className="group block">{body}</div>;
  return (
    <Link href={`/products/${product.slug}`} className="group block focus-visible:outline-offset-4">
      {body}
    </Link>
  );
}

export function ProductGrid({ items, linkable = true, priorityCount = 0 }: { items: ProductCardData[]; linkable?: boolean; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} linkable={linkable} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
