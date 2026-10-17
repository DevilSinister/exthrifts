import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing } from "@/components/store/Listing";
import { db } from "@/lib/db";

async function load(slug: string) {
  return db.category.findUnique({ where: { slug }, select: { name: true, slug: true, description: true } });
}

export async function generateMetadata({ params, searchParams }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await load(slug);
  if (!category) return {};
  return {
    title: `Vintage ${category.name}`,
    description: category.description ?? `One-of-one vintage ${category.name.toLowerCase()} with real measurements. Cash on delivery across Pakistan.`,
    alternates: { canonical: `/category/${category.slug}` },
    robots: Object.keys(sp).some((k) => k !== "page") ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const category = await load(slug);
  if (!category) notFound();
  return (
    <Listing
      title={category.name}
      intro={category.description}
      basePath={`/category/${category.slug}`}
      searchParams={await searchParams}
      scope={{ category: category.slug }}
    />
  );
}
