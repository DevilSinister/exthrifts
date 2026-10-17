import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing } from "@/components/store/Listing";
import { db } from "@/lib/db";

async function load(slug: string) {
  return db.collection.findFirst({ where: { slug, isActive: true }, select: { name: true, slug: true, description: true } });
}

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const collection = await load((await params).slug);
  if (!collection) return {};
  return {
    title: collection.name,
    description: collection.description ?? `${collection.name}: hand-picked one-of-one vintage.`,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const collection = await load((await params).slug);
  if (!collection) notFound();
  return (
    <Listing
      title={collection.name}
      intro={collection.description}
      basePath={`/collections/${collection.slug}`}
      searchParams={await searchParams}
      scope={{ collection: collection.slug }}
    />
  );
}
