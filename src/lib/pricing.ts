// The single place money is computed. The cart, the checkout page and the
// order the server stores all call priceCart, so what the customer sees is
// what gets saved (PitchWear computed these in three places and they drifted).

export type CouponKind = "PERCENT" | "FIXED" | "FREE_SHIPPING";

export interface CouponRule {
  code: string;
  type: CouponKind;
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export interface ShippingRule {
  /** Flat delivery fee in rupees. */
  flatRate: number;
  /** Free delivery when the subtotal reaches this; null = never free. */
  freeOver: number | null;
}

export interface PriceLine {
  price: number;
  quantity: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export type CouponCheck = { ok: true } | { ok: false; reason: string };

export function checkCoupon(coupon: CouponRule, subtotal: number, now: Date): CouponCheck {
  if (!coupon.isActive) return { ok: false, reason: "This code is not active." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, reason: "This code is not active yet." };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, reason: "This code has expired." };
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "This code has been fully used." };
  }
  if (subtotal < coupon.minSubtotal) {
    return { ok: false, reason: `Add items worth Rs ${coupon.minSubtotal - subtotal} more to use this code.` };
  }
  return { ok: true };
}

export function priceCart(
  lines: PriceLine[],
  shippingRule: ShippingRule,
  coupon: Pick<CouponRule, "type" | "value"> | null = null,
): CartTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  let discount = 0;
  if (coupon?.type === "PERCENT") {
    const percent = Math.min(Math.max(coupon.value, 0), 100);
    discount = Math.floor((subtotal * percent) / 100);
  } else if (coupon?.type === "FIXED") {
    discount = Math.min(Math.max(coupon.value, 0), subtotal);
  }

  const freeByThreshold = shippingRule.freeOver !== null && subtotal >= shippingRule.freeOver;
  const freeByCoupon = coupon?.type === "FREE_SHIPPING";
  const shipping = subtotal === 0 || freeByThreshold || freeByCoupon ? 0 : Math.max(shippingRule.flatRate, 0);

  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}
