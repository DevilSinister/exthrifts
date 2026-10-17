// Placing an order. This is the ONLY place stock is decremented and soldAt is
// set: the cart reserves nothing. Every piece is claimed with a conditional
// UPDATE (stock >= qty), so two shoppers checking out the same one-of-one at
// the same moment get one order and one "just sold" message.
import { z } from "zod";
import { db } from "@/lib/db";
import { buyableWhere, isBuyable, shopperState } from "@/lib/catalog/visibility";
import { normalizePkPhone } from "@/lib/phone";
import { checkCoupon, priceCart, type CouponRule } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export const MAX_LINES = 20;
export const MAX_QTY = 5;

export const checkoutSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(MAX_QTY) }))
    .min(1, "Your cart is empty.")
    .max(MAX_LINES),
  customerName: z.string().trim().min(2, "Enter your full name.").max(100),
  phone: z.string().trim().min(10, "Enter a valid mobile number.").max(20),
  email: z.union([z.literal(""), z.email("Enter a valid email or leave it empty.").max(191)]).optional(),
  city: z.string().trim().min(2, "Choose your city.").max(80),
  address: z.string().trim().min(10, "Enter your full address (house, street, area).").max(500),
  notes: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().max(40).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly soldProductIds: string[] = [],
    readonly field?: string,
  ) {
    super(message);
  }
}

function toCouponRule(c: {
  code: string;
  type: CouponRule["type"];
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}): CouponRule {
  return { ...c };
}

/** Merge duplicate lines so one product can't be claimed twice in one order. */
function mergeLines(items: CheckoutInput["items"]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const item of items) merged.set(item.productId, Math.min((merged.get(item.productId) ?? 0) + item.quantity, MAX_QTY));
  return merged;
}

export async function placeOrder(raw: unknown, now = new Date()): Promise<{ id: string; number: number }> {
  const input = checkoutSchema.parse(raw);
  const phone = normalizePkPhone(input.phone);
  if (!phone) throw new CheckoutError("Enter a Pakistani mobile number like 0300 1234567.", [], "phone");

  const lines = mergeLines(input.items);
  const settings = await getSettings();

  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: [...lines.keys()] } },
      include: {
        drop: { select: { startsAt: true, cancelledAt: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });

    const unavailable = [...lines.entries()]
      .filter(([id, qty]) => {
        const p = products.find((x) => x.id === id);
        return !p || !isBuyable(p, now) || p.stock < qty;
      })
      .map(([id]) => id);
    if (unavailable.length) {
      const notYetLive = unavailable.every((id) => {
        const p = products.find((x) => x.id === id);
        return p && shopperState(p, now) === "hidden" && p.stock > 0;
      });
      throw new CheckoutError(
        notYetLive
          ? "This piece isn't on sale yet. It goes live with its drop."
          : unavailable.length === 1
            ? "A piece in your cart was just sold."
            : "Some pieces in your cart were just sold.",
        unavailable,
      );
    }

    // Price from the database, never from the browser.
    const priceLines = products.map((p) => ({ price: p.price, quantity: lines.get(p.id)! }));
    const preTotals = priceCart(priceLines, settings.shipping);

    let coupon: Awaited<ReturnType<typeof tx.coupon.findUnique>> = null;
    if (input.couponCode) {
      coupon = await tx.coupon.findUnique({ where: { code: input.couponCode.toUpperCase() } });
      if (!coupon) throw new CheckoutError("That discount code doesn't exist.", [], "couponCode");
      const check = checkCoupon(toCouponRule(coupon), preTotals.subtotal, now);
      if (!check.ok) throw new CheckoutError(check.reason, [], "couponCode");
      // Claim a use atomically so a limited code can't be over-redeemed.
      const claimed = await tx.coupon.updateMany({
        where: {
          id: coupon.id,
          ...(coupon.maxUses !== null ? { usedCount: { lt: coupon.maxUses } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new CheckoutError("This code has been fully used.", [], "couponCode");
    }

    const totals = priceCart(priceLines, settings.shipping, coupon);

    // Claim each piece. A zero count means someone else got it first.
    for (const p of products) {
      const qty = lines.get(p.id)!;
      const claimed = await tx.product.updateMany({
        where: { AND: [{ id: p.id, stock: { gte: qty } }, buyableWhere(now)] },
        data: { stock: { decrement: qty } },
      });
      if (claimed.count !== 1) throw new CheckoutError("A piece in your cart was just sold.", [p.id]);
      // Re-read rather than trust the earlier snapshot: an admin may have adjusted stock meanwhile.
      await tx.product.updateMany({ where: { id: p.id, stock: { lte: 0 } }, data: { soldAt: now } });
    }

    const order = await tx.order.create({
      data: {
        customerName: input.customerName,
        phone,
        email: input.email || null,
        city: input.city,
        address: input.address,
        notes: input.notes || null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        total: totals.total,
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            title: p.title,
            size: p.size,
            price: p.price,
            quantity: lines.get(p.id)!,
            imageKey: p.images[0]?.key ?? null,
          })),
        },
        events: { create: { type: "created", toStatus: "PENDING", message: "Order placed (cash on delivery)." } },
      },
      select: { id: true, number: true },
    });

    await tx.inventoryLog.createMany({
      data: products.map((p) => ({
        productId: p.id,
        change: -lines.get(p.id)!,
        before: p.stock,
        after: p.stock - lines.get(p.id)!,
        reason: "Sold at checkout",
        orderId: order.id,
      })),
    });

    return order;
  });
}

/** Re-checks a browser cart without changing anything (cart and checkout pages). */
export async function inspectCart(productIds: string[], now = new Date()) {
  const ids = [...new Set(productIds)].slice(0, MAX_LINES);
  if (!ids.length) return [];
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    include: {
      drop: { select: { startsAt: true, cancelledAt: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
  });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    size: p.size,
    price: p.price,
    stock: p.stock,
    imageKey: p.images[0]?.key ?? null,
    imageAlt: p.images[0]?.alt || p.title,
    available: isBuyable(p, now),
  }));
}
