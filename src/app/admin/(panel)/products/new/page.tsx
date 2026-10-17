import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Add a piece" };

export default async function NewProductPage() {
  await requireAdmin();
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader back={{ href: "/admin/products", label: "Pieces" }} title="Add a piece" subtitle="Saved as a draft until you set it live." />
      <ProductEditor
        categories={categories}
        collections={collections}
        product={{
          title: "",
          slug: "",
          description: "",
          status: "DRAFT",
          price: null,
          compareAtPrice: null,
          costPrice: null,
          stock: 1,
          size: "",
          measurements: {},
          conditionGrade: null,
          conditionNotes: "",
          brand: "",
          era: "",
          tags: "",
          seoTitle: "",
          seoDescription: "",
          categoryId: "",
          collectionIds: [],
          images: [],
          dropName: null,
        }}
      />
    </>
  );
}
