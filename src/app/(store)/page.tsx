import Image from "next/image";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Countdown } from "@/components/store/Countdown";
import { ProductGrid, measurementLine } from "@/components/store/ProductCard";
import { categoryTiles, homeCollections, listProducts, nextAnnouncedDrop } from "@/lib/catalog/queries";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { absoluteUrl, site } from "@/lib/site";

// Home rows lead with pieces you can still buy; sold pieces keep their 7 days on /shop and category pages.
function availableFirst<T extends { state: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.state !== "available") - Number(b.state !== "available"));
}

const karachiDate = new Intl.DateTimeFormat("en-PK", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});

export const metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const now = new Date();
  const [settings, latest, tiles, drop, collections] = await Promise.all([
    getSettings(),
    listProducts({ page: 1 }, now),
    categoryTiles(now),
    nextAnnouncedDrop(now),
    homeCollections(now),
  ]);
  const { hero, shipping, proof } = settings;
  const rack = latest.items.filter((p) => p.state === "available" && p.images.length).slice(0, 3);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.url,
    logo: absoluteUrl("/icon-512.png"),
    sameAs: [settings.store.instagram, settings.store.tiktok, settings.store.facebook].filter((u) => /^https?:\/\//.test(u)),
  };

  return (
    <>
      <JsonLd data={orgJsonLd} />

      {/* Hero: the promise on the left, the rack itself on the right. */}
      <section className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-10 px-4 pb-14 pt-8 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-14">
        <div className="flex flex-col items-start gap-5">
          <p className="label inline-flex items-center gap-2 border-2 border-ink px-2 py-1">{hero.eyebrow}</p>
          <h1 className="display text-[3.4rem] sm:text-7xl lg:text-[5.5rem]">{hero.title}</h1>
          <p className="max-w-md text-lg leading-relaxed text-ink-soft">{hero.subtitle}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={hero.ctaHref || "/shop"} className="btn btn-ink">
              {hero.ctaLabel}
            </Link>
            {drop && (
              <Link href={`/drops/${drop.slug}`} className="btn btn-line">
                Next drop
              </Link>
            )}
          </div>
        </div>

        {hero.imageKey ? (
          <div className="relative aspect-[4/5] overflow-hidden border-2 border-ink md:aspect-[5/6]">
            <Image src={mediaSrc(hero.imageKey)} alt="" fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          </div>
        ) : rack.length > 0 ? (
          <ul className="relative mx-auto grid h-[26rem] w-full max-w-md sm:h-[30rem]" aria-label="Just in">
            {rack.map((p, i) => (
              <li
                key={p.id}
                className="absolute w-[58%] transition-transform duration-500 ease-[var(--ease-out-expo)] hover:z-10 hover:-translate-y-2"
                style={{
                  left: `${[0, 42, 21][i]}%`,
                  top: `${[4, 0, 30][i]}%`,
                  transform: `rotate(${[-6, 5, -1.5][i]}deg)`,
                  zIndex: [1, 2, 3][i],
                }}
              >
                <Link href={`/products/${p.slug}`} className="block border-2 border-ink bg-card p-2 shadow-[4px_6px_0_rgba(13,13,12,0.9)]">
                  <div className="relative aspect-[4/5] overflow-hidden bg-sunken">
                    <Image src={mediaSrc(p.images[0].key)} alt={p.images[0].alt} fill priority={i === 0} sizes="(min-width: 768px) 25vw, 55vw" className="object-cover" />
                  </div>
                  <hr className="tear my-2" />
                  <p className="tag-text flex justify-between gap-2 text-[0.8125rem]">
                    <span className="truncate">{[p.size, measurementLine(p.measurements)].filter(Boolean).join(" · ")}</span>
                    <span className="font-bold">{formatRs(p.price)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {drop && (
        <section className="bg-ink text-paper">
          <div className="mx-auto grid grid-cols-1 max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
            <div className="flex flex-col gap-2">
              <p className="label text-paper/70">Next drop · {karachiDate.format(drop.startsAt)} (PKT)</p>
              <h2 className="display text-5xl sm:text-6xl">{drop.name}</h2>
              <p className="text-paper/80">Pieces go live at the exact second the clock hits zero. First to check out gets them.</p>
            </div>
            <div className="flex flex-col gap-4 text-ink md:w-[28rem]">
              <Countdown targetMs={drop.startsAt.getTime()} serverNowMs={now.getTime()} size="md" />
              <Link href={`/drops/${drop.slug}`} className="btn border-paper bg-paper text-ink hover:bg-sunken">
                Preview the drop
              </Link>
            </div>
          </div>
        </section>
      )}

      {tiles.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6" aria-labelledby="shop-by">
          <h2 id="shop-by" className="display mb-5 text-4xl">
            Shop by rack
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((t) => (
              <li key={t.id}>
                <Link href={`/category/${t.slug}`} className="group block border-2 border-ink bg-card">
                  <div className="relative aspect-square overflow-hidden bg-sunken">
                    {t.cover ? (
                      <Image
                        src={mediaSrc(t.cover.key)}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
                        className="object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span aria-hidden className="display absolute inset-0 flex items-center justify-center p-3 text-center text-3xl text-muted">
                        {t.name}
                      </span>
                    )}
                  </div>
                  <span className="flex items-center justify-between border-t-2 border-ink px-3 py-2.5">
                    <span className="label text-[0.8125rem]">{t.name}</span>
                    <span aria-hidden>→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6" aria-labelledby="just-in">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="just-in" className="display text-4xl">
            Just in
          </h2>
          <Link href="/shop" className="label underline underline-offset-4">
            See all {latest.total}
          </Link>
        </div>
        {latest.items.length ? (
          <ProductGrid items={availableFirst(latest.items).slice(0, 8)} />
        ) : (
          <p className="border-2 border-dashed border-rule p-8 text-center text-muted">New pieces are being tagged. Check back soon.</p>
        )}
      </section>

      {collections.map((c) => (
        <section key={c.id} className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="display text-4xl">{c.name}</h2>
            <Link href={`/collections/${c.slug}`} className="label underline underline-offset-4">
              See all
            </Link>
          </div>
          <ProductGrid items={availableFirst(c.items).slice(0, 4)} />
        </section>
      ))}

      {proof.reviews.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6" aria-labelledby="reviews">
          <h2 id="reviews" className="display mb-5 text-4xl">
            From the people who copped
          </h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {proof.reviews.map((r, i) => (
              <li key={i} className="border-2 border-ink bg-card p-5">
                <blockquote className="text-[0.9375rem] leading-relaxed">“{r.text}”</blockquote>
                <p className="tag-text mt-3 text-sm text-muted">
                  {r.name}
                  {r.city ? `, ${r.city}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <ul className="grid grid-cols-1 border-2 border-ink bg-card sm:grid-cols-3">
          {[
            ["Cash on delivery", "Pay the rider when it arrives. No card needed."],
            ["Delivery", shipping.deliveryText],
            ["One of one", "Adding to cart doesn't hold a piece. Whoever checks out first gets it."],
          ].map(([title, text], i) => (
            <li key={title} className={`p-5 ${i ? "border-t-2 border-dashed border-ink sm:border-l-2 sm:border-t-0" : ""}`}>
              <h3 className="label mb-1 text-[0.8125rem]">{title}</h3>
              <p className="text-sm text-ink-soft">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
