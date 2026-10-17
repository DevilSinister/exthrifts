import { AuthError, assertAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/site";

export async function GET() {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AuthError) return new Response(error.message, { status: error.status });
    throw error;
  }
  const products = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 10000,
    include: { category: { select: { name: true } }, drop: { select: { name: true } } },
  });
  const csv = toCsv(
    ["Title", "Status", "Price", "Was", "Cost", "Stock", "Size", "Brand", "Era", "Condition", "Category", "Drop", "Sold at", "URL"],
    products.map((p) => [
      p.title,
      p.status,
      p.price,
      p.compareAtPrice,
      p.costPrice,
      p.stock,
      p.size,
      p.brand,
      p.era,
      p.conditionGrade,
      p.category?.name,
      p.drop?.name,
      p.soldAt?.toISOString(),
      absoluteUrl(`/products/${p.slug}`),
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pieces-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
