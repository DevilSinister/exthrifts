"use server";

import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { CheckoutError, inspectCart, MAX_LINES, placeOrder } from "@/lib/orders/checkout";
import { STATUS_LABEL } from "@/lib/orders/transitions";
import { normalizePkPhone } from "@/lib/phone";
import { formatOrderNumber, parseOrderNumber } from "@/lib/site";
import { checkCoupon, priceCart, type CartTotals } from "@/lib/pricing";
import { dispatchDue, enqueueOrderAlert } from "@/lib/push/outbox";
import { getSettings } from "@/lib/settings";

const idsSchema = z.array(z.string().min(1).max(40)).max(MAX_LINES);
const linesSchema = z.array(z.object({ productId: z.string().min(1).max(40), quantity: z.number().int().min(1).max(5) })).max(MAX_LINES);

export async function inspectCartAction(productIds: string[]) {
  const ids = idsSchema.safeParse(productIds);
  if (!ids.success) return [];
  return inspectCart(ids.data);
}

export interface Quote extends CartTotals {
  couponCode: string | null;
  couponError: string | null;
}

/** Prices a cart without changing anything, using the same function checkout stores. */
export async function quoteAction(lines: unknown, couponCode?: string): Promise<Quote> {
  const parsed = linesSchema.safeParse(lines);
  const now = new Date();
  const settings = await getSettings();
  if (!parsed.success || !parsed.data.length) {
    return { ...priceCart([], settings.shipping), couponCode: null, couponError: null };
  }
  const items = await inspectCart(parsed.data.map((l) => l.productId), now);
  const priceLines = items
    .filter((i) => i.available)
    .map((i) => ({ price: i.price, quantity: parsed.data.find((l) => l.productId === i.id)?.quantity ?? 1 }));
  const base = priceCart(priceLines, settings.shipping);

  const code = couponCode?.trim().toUpperCase();
  if (!code) return { ...base, couponCode: null, couponError: null };
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return { ...base, couponCode: null, couponError: "That code doesn't exist." };
  const check = checkCoupon(coupon, base.subtotal, now);
  if (!check.ok) return { ...base, couponCode: null, couponError: check.reason };
  return { ...priceCart(priceLines, settings.shipping, coupon), couponCode: coupon.code, couponError: null };
}

export interface TrackResult {
  error?: string;
  order?: {
    label: string;
    status: string;
    placedAt: string;
    courier: string | null;
    trackingNo: string | null;
    events: Array<{ at: string; text: string }>;
  };
}

/** Order lookup needs both the number and the phone it was placed with. POST only: no phone in URLs. */
export async function trackOrderAction(_prev: TrackResult, formData: FormData): Promise<TrackResult> {
  const number = parseOrderNumber(String(formData.get("order") ?? ""));
  const phone = normalizePkPhone(String(formData.get("phone") ?? ""));
  const notFound = { error: "We couldn't find an order with that number and phone. Check both and try again." };
  if (!number || !phone) return notFound;
  const order = await db.order.findUnique({
    where: { number },
    select: {
      number: true,
      phone: true,
      status: true,
      createdAt: true,
      courier: true,
      trackingNo: true,
      events: { where: { type: { in: ["created", "status"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, toStatus: true } },
    },
  });
  if (!order || order.phone !== phone) return notFound;
  const fmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });
  return {
    order: {
      label: formatOrderNumber(order.number),
      status: STATUS_LABEL[order.status],
      placedAt: fmt.format(order.createdAt),
      courier: order.courier,
      trackingNo: order.trackingNo,
      events: order.events
        .filter((e) => e.toStatus)
        .map((e) => ({ at: fmt.format(e.createdAt), text: e.toStatus === "PENDING" ? "Order placed" : STATUS_LABEL[e.toStatus!] })),
    },
  };
}

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string; soldIds?: string[]; fieldErrors?: Record<string, string> };

export async function placeOrderAction(input: unknown): Promise<PlaceOrderResult> {
  try {
    const order = await placeOrder(input);
    // Alert the owner's phone after the response is sent, so checkout stays fast.
    after(async () => {
      try {
        await enqueueOrderAlert(order.id);
        await dispatchDue(10, order.id);
      } catch (error) {
        console.error("[push] order alert failed", { orderId: order.id, error: error instanceof Error ? error.message : error });
      }
    });
    return { ok: true, orderId: order.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = String(issue.path[0] ?? "form");
        fieldErrors[key] ??= issue.message;
      }
      return { ok: false, error: "Check the highlighted fields.", fieldErrors };
    }
    if (error instanceof CheckoutError) {
      return {
        ok: false,
        error: error.message,
        soldIds: error.soldProductIds,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    console.error("[checkout] failed", error instanceof Error ? { message: error.message } : error);
    return { ok: false, error: "Your order wasn't placed because something went wrong on our side. Please try again in a minute." };
  }
}
