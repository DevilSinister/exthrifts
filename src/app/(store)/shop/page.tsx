import type { Metadata } from "next";
import { Listing } from "@/components/store/Listing";

export async function generateMetadata({ searchParams }: PageProps<"/shop">): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return {
    title: "Shop all vintage",
    description: "Every one-of-one piece on the rack, with sizes, measurements and condition. Cash on delivery across Pakistan.",
    alternates: { canonical: "/shop" },
    // Filtered and searched views are thin duplicates of the main rack.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  return <Listing title="All pieces" basePath="/shop" searchParams={await searchParams} scope={{}} />;
}
