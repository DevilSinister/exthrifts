import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/store/Countdown";
import { ProductGrid } from "@/components/store/ProductCard";
import { getDropPage } from "@/lib/catalog/queries";
import { mediaSrc } from "@/lib/images/loader";

const when = new Intl.DateTimeFormat("en-PK", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Karachi",
});

export async function generateMetadata({ params }: PageProps<"/drops/[slug]">): Promise<Metadata> {
  const data = await getDropPage((await params).slug);
  if (!data) return { title: "Drop not found" };
  return {
    title: data.drop.name,
    description: data.drop.description ?? `${data.drop.name}: one-of-one vintage, live ${when.format(data.drop.startsAt)} (PKT).`,
    alternates: { canonical: `/drops/${data.drop.slug}` },
  };
}

export default async function DropPage({ params }: PageProps<"/drops/[slug]">) {
  const now = new Date();
  const data = await getDropPage((await params).slug, now);
  if (!data) notFound();
  const { drop, items, live } = data;
  const showPieces = live || drop.showPreview;

  return (
    <div>
      <section className="relative overflow-hidden bg-ink text-paper">
        {drop.coverKey && (
          <Image src={mediaSrc(drop.coverKey)} alt="" fill priority sizes="100vw" className="object-cover opacity-35 grayscale" />
        )}
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:px-6 md:py-20">
          <p className="label text-paper/80">
            {live ? "Live now" : "Drops"} · {when.format(drop.startsAt)} PKT
          </p>
          <h1 className="display text-6xl sm:text-8xl">{drop.name}</h1>
          {drop.description && <p className="max-w-xl text-lg text-paper/85">{drop.description}</p>}
          {!live && (
            <div className="max-w-xl text-ink">
              <Countdown targetMs={drop.startsAt.getTime()} serverNowMs={now.getTime()} />
            </div>
          )}
          <p className="tag-text text-sm text-paper/80">
            {items.length} piece{items.length === 1 ? "" : "s"} · one of each · first to check out gets it
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        {showPieces ? (
          <>
            {!live && (
              <p className="mb-6 border-2 border-dashed border-ink p-4 text-sm">
                Preview only. These pieces can&apos;t be opened or bought until the clock hits zero — keep this page open and it
                unlocks by itself.
              </p>
            )}
            <ProductGrid items={items} linkable={live} />
          </>
        ) : (
          <p className="border-2 border-dashed border-rule p-10 text-center text-muted">The pieces are under wraps until the drop opens.</p>
        )}
      </section>
    </div>
  );
}
