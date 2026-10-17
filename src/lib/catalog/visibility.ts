// One rule decides what a shopper can see and buy. Listings, search, product
// pages, the sitemap and checkout all use it, so a drop can never leak early
// through one surface while another hides it.
//
//  live      = PUBLISHED and (no drop, or the drop's start time has passed)
//  listed    = live and (in stock, or sold within the last SOLD_VISIBLE_DAYS)
//  buyable   = live and in stock
//
// "Live" is computed from the clock at request time, so a drop goes live
// exactly at startsAt with no scheduler.

import type { Prisma } from "@/generated/prisma/client";

export const SOLD_VISIBLE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface VisibilityInput {
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  stock: number;
  soldAt: Date | null;
  drop: { startsAt: Date; cancelledAt: Date | null } | null;
}

export type ShopperState =
  | "hidden" // not published, or its drop has not started
  | "available" // live and in stock
  | "sold-recent" // live, sold within SOLD_VISIBLE_DAYS: listed with a SOLD badge
  | "sold-archived"; // live, sold earlier: page still opens (noindex), not listed

export function soldCutoff(now: Date): Date {
  return new Date(now.getTime() - SOLD_VISIBLE_DAYS * DAY_MS);
}

export function isLive(p: Pick<VisibilityInput, "status" | "drop">, now: Date): boolean {
  if (p.status !== "PUBLISHED") return false;
  if (!p.drop) return true;
  if (p.drop.cancelledAt) return false;
  return p.drop.startsAt.getTime() <= now.getTime();
}

export function shopperState(p: VisibilityInput, now: Date): ShopperState {
  if (!isLive(p, now)) return "hidden";
  if (p.stock > 0) return "available";
  // A sold piece with no timestamp (legacy/manual stock edit) counts as archived.
  if (p.soldAt && p.soldAt.getTime() >= soldCutoff(now).getTime()) return "sold-recent";
  return "sold-archived";
}

export function isListed(p: VisibilityInput, now: Date): boolean {
  const state = shopperState(p, now);
  return state === "available" || state === "sold-recent";
}

export function isBuyable(p: VisibilityInput, now: Date): boolean {
  return shopperState(p, now) === "available";
}

/** Prisma filter for "live" products. */
export function liveWhere(now: Date): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ dropId: null }, { drop: { startsAt: { lte: now }, cancelledAt: null } }],
  };
}

/** Prisma filter for products shown in listings (available + sold in the last 7 days). */
export function listedWhere(now: Date): Prisma.ProductWhereInput {
  return {
    AND: [liveWhere(now), { OR: [{ stock: { gt: 0 } }, { soldAt: { gte: soldCutoff(now) } }] }],
  };
}

/** Prisma filter for products that can be bought right now. */
export function buyableWhere(now: Date): Prisma.ProductWhereInput {
  return { AND: [liveWhere(now), { stock: { gt: 0 } }] };
}

/**
 * Listing order: available pieces first (soldAt is NULL, which MySQL sorts
 * first ascending), newest first; recently sold pieces after them.
 */
export const listedOrderBy: Prisma.ProductOrderByWithRelationInput[] = [
  { soldAt: "asc" },
  { publishedAt: "desc" },
  { createdAt: "desc" },
];
