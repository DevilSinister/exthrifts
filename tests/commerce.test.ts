import { describe, expect, it } from "vitest";
import { checkCoupon, priceCart, type CouponRule } from "@/lib/pricing";
import { displayPhone, normalizePkPhone, whatsappLink } from "@/lib/phone";
import { formatOrderNumber, parseOrderNumber } from "@/lib/site";
import {
  ORDER_STATUSES,
  canTransition,
  missingForTransition,
  restocksOn,
  type OrderStatusName,
} from "@/lib/orders/transitions";
import { formatRs, percentOff } from "@/lib/money";

const shipping = { flatRate: 250, freeOver: 5000 };

function coupon(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    code: "TEST",
    type: "PERCENT",
    value: 10,
    minSubtotal: 0,
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    ...overrides,
  };
}

describe("priceCart", () => {
  it("adds flat shipping under the free threshold", () => {
    expect(priceCart([{ price: 1500, quantity: 1 }], shipping)).toEqual({
      subtotal: 1500,
      discount: 0,
      shipping: 250,
      total: 1750,
    });
  });

  it("ships free at the threshold", () => {
    expect(priceCart([{ price: 2500, quantity: 2 }], shipping).shipping).toBe(0);
  });

  it("never charges shipping on an empty cart", () => {
    expect(priceCart([], shipping).total).toBe(0);
  });

  it("applies a percent coupon rounded down", () => {
    const totals = priceCart([{ price: 1999, quantity: 1 }], shipping, coupon({ value: 10 }));
    expect(totals.discount).toBe(199);
    expect(totals.total).toBe(1999 - 199 + 250);
  });

  it("caps a fixed coupon at the subtotal", () => {
    const totals = priceCart([{ price: 500, quantity: 1 }], shipping, coupon({ type: "FIXED", value: 900 }));
    expect(totals.discount).toBe(500);
    expect(totals.total).toBe(250);
  });

  it("waives shipping for a free-shipping coupon", () => {
    const totals = priceCart([{ price: 800, quantity: 1 }], shipping, coupon({ type: "FREE_SHIPPING" }));
    expect(totals).toEqual({ subtotal: 800, discount: 0, shipping: 0, total: 800 });
  });

  it("never has a free threshold when freeOver is null", () => {
    expect(priceCart([{ price: 90000, quantity: 1 }], { flatRate: 300, freeOver: null }).shipping).toBe(300);
  });
});

describe("checkCoupon", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  it("accepts a valid code", () => expect(checkCoupon(coupon(), 1000, now)).toEqual({ ok: true }));
  it("refuses inactive, early, expired and used-up codes", () => {
    expect(checkCoupon(coupon({ isActive: false }), 1000, now).ok).toBe(false);
    expect(checkCoupon(coupon({ startsAt: new Date("2026-10-18T00:00:00Z") }), 1000, now).ok).toBe(false);
    expect(checkCoupon(coupon({ endsAt: new Date("2026-10-16T00:00:00Z") }), 1000, now).ok).toBe(false);
    expect(checkCoupon(coupon({ maxUses: 3, usedCount: 3 }), 1000, now).ok).toBe(false);
  });
  it("explains a minimum subtotal shortfall", () => {
    const result = checkCoupon(coupon({ minSubtotal: 3000 }), 2500, now);
    expect(result).toEqual({ ok: false, reason: "Add items worth Rs 500 more to use this code." });
  });
});

describe("normalizePkPhone", () => {
  it.each([
    ["03001234567", "+923001234567"],
    ["0300-1234567", "+923001234567"],
    ["0300 123 4567", "+923001234567"],
    ["+92 300 1234567", "+923001234567"],
    ["923001234567", "+923001234567"],
    ["00923001234567", "+923001234567"],
    ["3001234567", "+923001234567"],
  ])("normalises %s", (input, expected) => expect(normalizePkPhone(input)).toBe(expected));

  it.each(["0421234567", "12345", "0300123456", "03001234567890", "abc", "+44 7700 900123"])(
    "rejects %s",
    (input) => expect(normalizePkPhone(input)).toBeNull(),
  );

  it("displays and links the stored form", () => {
    expect(displayPhone("+923001234567")).toBe("0300 1234567");
    expect(whatsappLink("+923001234567", "Hi")).toBe("https://wa.me/923001234567?text=Hi");
  });
});

describe("order numbers", () => {
  it("formats and parses round-trip", () => {
    expect(formatOrderNumber(1, "EXT")).toBe("EXT-1001");
    expect(parseOrderNumber("EXT-1001")).toBe(1);
    expect(parseOrderNumber("#1042")).toBe(42);
    expect(parseOrderNumber("ext 1042")).toBe(42);
  });
  it("rejects numbers at or below the offset and junk", () => {
    expect(parseOrderNumber("1000")).toBeNull();
    expect(parseOrderNumber("hello")).toBeNull();
  });
});

describe("order transitions", () => {
  const allowed: Array<[OrderStatusName, OrderStatusName]> = [
    ["PENDING", "PROCESSING"],
    ["PENDING", "CANCELLED"],
    ["PROCESSING", "SHIPPED"],
    ["PROCESSING", "CANCELLED"],
    ["SHIPPED", "DELIVERED"],
    ["SHIPPED", "RETURNED"],
    ["DELIVERED", "RETURNED"],
  ];

  it("allows exactly the documented edges", () => {
    let checked = 0;
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = allowed.some(([a, b]) => a === from && b === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
        checked += 1;
      }
    }
    // Guard against the loop silently checking nothing.
    expect(checked).toBe(36);
  });

  it("restocks only on cancel and return", () => {
    expect(ORDER_STATUSES.filter(restocksOn)).toEqual(["CANCELLED", "RETURNED"]);
  });

  it("requires a courier to ship", () => {
    expect(missingForTransition("SHIPPED", {})).not.toBeNull();
    expect(missingForTransition("SHIPPED", { courier: "  " })).not.toBeNull();
    expect(missingForTransition("SHIPPED", { courier: "TCS" })).toBeNull();
    expect(missingForTransition("CANCELLED", {})).toBeNull();
  });
});

describe("money", () => {
  it("formats rupees", () => expect(formatRs(12500)).toBe("Rs 12,500"));
  it("computes percent off only for real savings", () => {
    expect(percentOff(1500, 3000)).toBe(50);
    expect(percentOff(1500, 1500)).toBeNull();
    expect(percentOff(1500, null)).toBeNull();
  });
});
