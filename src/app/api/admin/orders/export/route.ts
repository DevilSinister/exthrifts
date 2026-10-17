import { AuthError, assertAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { isOrderStatus } from "@/lib/orders/transitions";
import { displayPhone } from "@/lib/phone";
import { formatOrderNumber } from "@/lib/site";

export async function GET(request: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AuthError) return new Response(error.message, { status: error.status });
    throw error;
  }
  const status = new URL(request.url).searchParams.get("status");
  const orders = await db.order.findMany({
    where: status && isOrderStatus(status) ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { items: { select: { title: true, size: true, quantity: true } } },
  });
  const csv = toCsv(
    ["Order", "Date", "Status", "Name", "Phone", "City", "Address", "Items", "Subtotal", "Discount", "Delivery", "Total", "Courier", "Tracking"],
    orders.map((o) => [
      formatOrderNumber(o.number),
      o.createdAt.toISOString(),
      o.status,
      o.customerName,
      displayPhone(o.phone),
      o.city,
      o.address,
      o.items.map((i) => `${i.quantity > 1 ? `${i.quantity}x ` : ""}${i.title}${i.size ? ` (${i.size})` : ""}`).join("; "),
      o.subtotal,
      o.discount,
      o.shipping,
      o.total,
      o.courier ?? "",
      o.trackingNo ?? "",
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
