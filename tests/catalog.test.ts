import { describe, expect, it } from "vitest";
import {
  isBuyable,
  isListed,
  shopperState,
  soldCutoff,
  type VisibilityInput,
} from "@/lib/catalog/visibility";
import {
  canAddToDrop,
  canRemoveFromDrop,
  checkSchedule,
  dropPhase,
  parsePakistanLocal,
  toPakistanLocal,
} from "@/lib/drops/rules";
import { clockOffset, formatRemaining, remaining } from "@/lib/countdown";
import {
  MAX_PUSH_ATTEMPTS,
  classifyFcmResponse,
  isSafeAdminPath,
  orderAlertPayload,
  retryDelaySeconds,
} from "@/lib/push/rules";

const now = new Date("2026-10-17T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function product(overrides: Partial<VisibilityInput> = {}): VisibilityInput {
  return { status: "PUBLISHED", stock: 1, soldAt: null, drop: null, ...overrides };
}

describe("visibility", () => {
  it("hides drafts and hidden products", () => {
    expect(shopperState(product({ status: "DRAFT" }), now)).toBe("hidden");
    expect(shopperState(product({ status: "HIDDEN" }), now)).toBe("hidden");
  });

  it("keeps a drop product hidden until the exact start time", () => {
    const drop = { startsAt: new Date(now.getTime() + 1000), cancelledAt: null };
    expect(shopperState(product({ drop }), now)).toBe("hidden");
    expect(isBuyable(product({ drop }), now)).toBe(false);
    expect(shopperState(product({ drop }), new Date(drop.startsAt))).toBe("available");
  });

  it("hides products of a cancelled drop", () => {
    const drop = { startsAt: new Date(now.getTime() - DAY), cancelledAt: new Date(now.getTime() - 1000) };
    expect(shopperState(product({ drop }), now)).toBe("hidden");
  });

  it("lists a piece sold 6 days ago with the SOLD state, not one sold 8 days ago", () => {
    const recent = product({ stock: 0, soldAt: new Date(now.getTime() - 6 * DAY) });
    const old = product({ stock: 0, soldAt: new Date(now.getTime() - 8 * DAY) });
    expect(shopperState(recent, now)).toBe("sold-recent");
    expect(isListed(recent, now)).toBe(true);
    expect(isBuyable(recent, now)).toBe(false);
    expect(shopperState(old, now)).toBe("sold-archived");
    expect(isListed(old, now)).toBe(false);
  });

  it("uses a 7 day cutoff", () => {
    expect(now.getTime() - soldCutoff(now).getTime()).toBe(7 * DAY);
  });

  it("treats an in-stock live piece as buyable", () => {
    expect(isBuyable(product(), now)).toBe(true);
  });
});

describe("drop rules", () => {
  it("derives the phase from the clock", () => {
    expect(dropPhase({ startsAt: new Date(now.getTime() + 1), cancelledAt: null }, now)).toBe("scheduled");
    expect(dropPhase({ startsAt: now, cancelledAt: null }, now)).toBe("live");
    expect(dropPhase({ startsAt: now, cancelledAt: now }, now)).toBe("cancelled");
  });

  it("refuses past or empty schedules", () => {
    expect(checkSchedule({ startsAt: new Date(now.getTime() - 1000), productCount: 3, now })).not.toBeNull();
    expect(checkSchedule({ startsAt: new Date(now.getTime() + DAY), productCount: 0, now })).not.toBeNull();
    expect(checkSchedule({ startsAt: new Date(now.getTime() + DAY), productCount: 3, now })).toBeNull();
    expect(
      checkSchedule({ startsAt: new Date(now.getTime() - 5000), productCount: 3, now, allowNow: true }),
    ).toBeNull();
  });

  it("allows one drop per product, drafts only", () => {
    expect(canAddToDrop({ status: "DRAFT", dropId: null }, "d1")).toBeNull();
    expect(canAddToDrop({ status: "DRAFT", dropId: "d2" }, "d1")).not.toBeNull();
    expect(canAddToDrop({ status: "PUBLISHED", dropId: null }, "d1")).not.toBeNull();
    expect(canAddToDrop({ status: "PUBLISHED", dropId: "d1" }, "d1")).toBeNull();
  });

  it("keeps ordered pieces in a live drop", () => {
    expect(canRemoveFromDrop("live", 1)).not.toBeNull();
    expect(canRemoveFromDrop("live", 0)).toBeNull();
    expect(canRemoveFromDrop("scheduled", 0)).toBeNull();
  });

  it("converts Pakistan local time (UTC+5) both ways", () => {
    const utc = parsePakistanLocal("2026-11-01T20:00");
    expect(utc.toISOString()).toBe("2026-11-01T15:00:00.000Z");
    expect(toPakistanLocal(utc)).toBe("2026-11-01T20:00");
    expect(Number.isNaN(parsePakistanLocal("tomorrow").getTime())).toBe(true);
  });
});

describe("countdown", () => {
  it("splits and formats the remaining time", () => {
    const r = remaining(Date.UTC(2026, 9, 19, 14, 3, 22), Date.UTC(2026, 9, 17, 0, 0, 0));
    expect(formatRemaining(r)).toBe("02d 14:03:22");
    expect(formatRemaining(remaining(65_000, 0))).toBe("00:01:05");
  });
  it("never goes negative", () => {
    expect(remaining(0, 10_000).totalMs).toBe(0);
  });
  it("corrects a wrong client clock with the server offset", () => {
    const serverNow = 1_000_000;
    const clientNow = 400_000; // phone clock 10 minutes slow
    const offset = clockOffset(serverNow, clientNow);
    expect(remaining(serverNow + 60_000, clientNow + offset).totalMs).toBe(60_000);
  });
});

describe("push rules", () => {
  it("bounds the backoff before it can overflow", () => {
    expect(retryDelaySeconds(0)).toBe(60);
    expect(retryDelaySeconds(1)).toBe(120);
    expect(retryDelaySeconds(3)).toBe(480);
    expect(retryDelaySeconds(4)).toBe(900);
    expect(retryDelaySeconds(1e9)).toBe(900);
    expect(retryDelaySeconds(-3)).toBe(60);
    expect(MAX_PUSH_ATTEMPTS).toBe(5);
  });

  it("removes a device only on a typed UNREGISTERED error", () => {
    const unregistered = { error: { details: [{ errorCode: "UNREGISTERED" }] } };
    expect(classifyFcmResponse(404, unregistered)).toBe("unregistered");
    expect(classifyFcmResponse(404, { error: { message: "not found" } })).toBe("fatal");
    expect(classifyFcmResponse(403, { error: { details: [{ errorCode: "SENDER_ID_MISMATCH" }] } })).toBe("fatal");
    expect(classifyFcmResponse(503, {})).toBe("retry");
    expect(classifyFcmResponse(429, {})).toBe("retry");
    expect(classifyFcmResponse(200, {})).toBe("sent");
  });

  it("only lets notification taps open admin paths", () => {
    expect(isSafeAdminPath("/admin/orders/abc123")).toBe(true);
    expect(isSafeAdminPath("/admin")).toBe(true);
    expect(isSafeAdminPath("//evil.com/admin")).toBe(false);
    expect(isSafeAdminPath("https://evil.com/admin")).toBe(false);
    expect(isSafeAdminPath("/products/x")).toBe(false);
    expect(isSafeAdminPath("/admin/../x")).toBe(false);
  });

  it("builds a string-only payload that targets the order page", () => {
    const payload = orderAlertPayload({
      orderId: "ck123",
      orderLabel: "EXT-1001",
      customerName: "Test Buyer",
      city: "Lahore",
      itemCount: 2,
      totalLabel: "Rs 4,250",
      siteName: "ExThrifts",
    });
    expect(Object.values(payload).every((v) => typeof v === "string")).toBe(true);
    expect(payload.targetPath).toBe("/admin/orders/ck123");
    expect(isSafeAdminPath(payload.targetPath)).toBe(true);
    expect(payload.title).toBe("New order EXT-1001 · Rs 4,250");
    expect(payload.body).toBe("Test Buyer, Lahore — 2 pieces");
  });
});
