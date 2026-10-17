import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { AddToCartButton } from "@/components/store/cart";
import { ProductGrid } from "@/components/store/ProductCard";
import { getProductPage, relatedProducts, type Measurements } from "@/lib/catalog/queries";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs, percentOff } from "@/lib/money";
import { normalizePkPhone, whatsappLink } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { absoluteUrl, site } from "@/lib/site";

const MEASURE_LABELS: Array<[keyof Measurements, string]> = [
  ["chest", "Chest (pit to pit)"],
  ["length", "Length"],
  ["shoulder", "Shoulder"],
  ["sleeve", "Sleeve"],
  ["waist", "Waist"],
  ["inseam", "Inseam"],
];

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const data = await getProductPage((await params).slug);
  if (!data) return { title: "Piece not found" };
  const { product, state } = data;
  const first = product.images[0];
  const description =
    product.seoDescription ??
    [product.size && `Size ${product.size}`, product.conditionGrade && `condition ${product.conditionGrade}/10`, formatRs(product.price), "cash on delivery"]
      .filter(Boolean)
      .join(", ");
  return {
    title: product.seoTitle ?? product.title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    // Pieces sold more than a week ago stay reachable for old links but leave the index.
    robots: state === "sold-archived" ? { index: false, follow: true } : undefined,
    openGraph: first ? { images: [{ url: `${mediaSrc(first.key)}-1600.webp`, alt: first.alt || product.title }] } : undefined,
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const data = await getProductPage((await params).slug);
  if (!data) notFound();
  const { product, state, measurements } = data;
  const [settings, related] = await Promise.all([getSettings(), relatedProducts(product.id, product.categoryId)]);
  const available = state === "available";
  const sold = !available;
  const off = percentOff(product.price, product.compareAtPrice);
  const measured = MEASURE_LABELS.filter(([key]) => measurements[key]);
  const whatsapp = normalizePkPhone(settings.store.whatsapp);
  const url = absoluteUrl(`/products/${product.slug}`);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.images.map((i) => absoluteUrl(`${mediaSrc(i.key)}-1600.webp`)),
    sku: product.id,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    size: product.size ?? undefined,
    itemCondition: "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: site.currency,
      price: product.price,
      availability: available ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      itemCondition: "https://schema.org/UsedCondition",
    },
  };
  const crumbs = [
    { name: "Home", url: absoluteUrl("/") },
    ...(product.category ? [{ name: product.category.name, url: absoluteUrl(`/category/${product.category.slug}`) }] : []),
    { name: product.title, url },
  ];
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <JsonLd data={productJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:underline">
              Home
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/category/${product.category.slug}`} className="hover:underline">
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-[1.15fr_1fr] lg:gap-14">
        {/* Gallery: swipe on phones, stacked on desktop. */}
        <div>
          {product.images.length ? (
            <ul
              className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:mx-0 md:flex-col md:gap-4 md:overflow-visible"
              aria-label="Photos"
            >
              {product.images.map((img, i) => (
                <li key={img.id} className="relative w-full shrink-0 snap-center">
                  <div className="relative aspect-[4/5] overflow-hidden bg-sunken md:border-2 md:border-ink">
                    <Image
                      src={mediaSrc(img.key)}
                      alt={img.alt || `${product.title}, photo ${i + 1}`}
                      fill
                      priority={i === 0}
                      sizes="(min-width: 768px) 55vw, 100vw"
                      className={`object-cover ${sold ? "grayscale" : ""}`}
                    />
                    <span className="tag-text absolute bottom-2 right-2 bg-paper/90 px-1.5 text-xs md:hidden">
                      {i + 1}/{product.images.length}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid aspect-[4/5] place-items-center border-2 border-dashed border-rule label text-muted">No photos yet</div>
          )}
        </div>

        {/* The hang-tag. */}
        <div className="md:sticky md:top-28 md:self-start">
          <article className="relative border-2 border-ink bg-card px-5 pb-6 pt-9 shadow-[5px_6px_0_rgba(13,13,12,0.9)]">
            <span aria-hidden className="absolute left-1/2 top-3 size-3.5 -translate-x-1/2 rounded-full border-2 border-ink bg-paper" />
            {sold && (
              <span className="stamp absolute right-4 top-6 text-3xl text-ink" role="status">
                Sold
              </span>
            )}
            <p className="label mb-2 text-muted">
              {[product.brand, product.era].filter(Boolean).join(" · ") || "One of one"}
            </p>
            <h1 className="display text-4xl sm:text-5xl">{product.title}</h1>

            <p className="mt-4 flex flex-wrap items-baseline gap-3">
              <span className={`tag-text text-2xl font-bold ${sold ? "line-through" : ""}`}>{formatRs(product.price)}</span>
              {!sold && off && (
                <>
                  <span className="tag-text text-muted line-through">{formatRs(product.compareAtPrice!)}</span>
                  <span className="chip chip-solid">−{off}%</span>
                </>
              )}
            </p>

            <hr className="tear-ink my-5" />

            <dl className="tag-text grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[0.9375rem]">
              {product.size && (
                <>
                  <dt className="text-muted">Size</dt>
                  <dd className="font-bold">{product.size}</dd>
                </>
              )}
              {measured.map(([key, label]) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd>{measurements[key]}″</dd>
                </div>
              ))}
              {product.conditionGrade && (
                <>
                  <dt className="text-muted">Condition</dt>
                  <dd>
                    <span className="font-bold">{product.conditionGrade}/10</span>
                    {product.conditionNotes ? ` — ${product.conditionNotes}` : ""}
                  </dd>
                </>
              )}
            </dl>
            {measured.length > 0 && <p className="mt-2 text-xs text-muted">Measured flat, in inches.</p>}

            <div className="mt-6 flex flex-col gap-3">
              <AddToCartButton productId={product.id} available={available} />
              {whatsapp && (
                <a
                  href={whatsappLink(whatsapp, `Hi! Is this still available? ${product.title} — ${url}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-line w-full"
                >
                  Ask on WhatsApp
                </a>
              )}
              <p className="text-sm text-muted">
                {available
                  ? "Only one exists. Adding it to your cart doesn't hold it — whoever checks out first gets it."
                  : "This piece has found its owner. New pieces are tagged every week."}
              </p>
            </div>
          </article>

          {product.description && (
            <section className="mt-8">
              <h2 className="label mb-2">About this piece</h2>
              <div className="flex max-w-prose flex-col gap-3 leading-relaxed text-ink-soft">
                {product.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8 grid gap-4 border-t-2 border-dashed border-rule pt-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="label mb-1">Delivery</h2>
              <p className="text-ink-soft">Cash on delivery. {settings.shipping.deliveryText}</p>
            </div>
            <div>
              <h2 className="label mb-1">Returns</h2>
              <p className="text-ink-soft">
                {settings.shipping.returnsText}{" "}
                <Link href="/pages/returns" className="underline underline-offset-4">
                  Policy
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-20" aria-labelledby="more">
          <h2 id="more" className="display mb-5 text-4xl">
            More from this rack
          </h2>
          <ProductGrid items={related} />
        </section>
      )}
    </div>
  );
}
