// Admin-side order changes. Status changes, bulk changes and slip printing all
// go through changeStatusInTx, so restocking and coupon give-back happen on
// every cancel/return path (PitchWear's status dropdown skipped them).
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  STATUS_LABEL,
  canTransition,
  missingForTransition,
  restocksOn,
  type OrderStatusName,
} from "@/lib/orders/transitions";

type Tx = Prisma.TransactionClient;

export class OrderActionError extends Error {}

export interface StatusChange {
  to: OrderStatusName;
  actorId: string;
  courier?: string | null;
  trackingNo?: string | null;
  message?: string | null;
}

async function restockOrder(tx: Tx, orderId: string, actorId: string, reason: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId, productId: { not: null } } });
  for (const item of items) {
    const product = await tx.product.findUnique({ where: { id: item.productId! }, select: { stock: true } });
    if (!product) continue;
    await tx.product.update({
      where: { id: item.productId! },
      data: { stock: { increment: item.quantity }, soldAt: null },
    });
    await tx.inventoryLog.create({
      data: {
        productId: item.productId!,
        change: item.quantity,
        before: product.stock,
        after: product.stock + item.quantity,
        reason,
        orderId,
        actorId,
      },
    });
  }
}

export async function changeStatusInTx(tx: Tx, orderId: string, change: StatusChange): Promise<void> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, couponId: true } });
  if (!order) throw new OrderActionError("Order not found.");
  const from = order.status as OrderStatusName;
  if (from === change.to) return;
  if (!canTransition(from, change.to)) {
    throw new OrderActionError(`Can't move an order from ${STATUS_LABEL[from]} to ${STATUS_LABEL[change.to]}.`);
  }
  const missing = missingForTransition(change.to, change);
  if (missing) throw new OrderActionError(missing);

  // Optimistic guard: if someone else changed it first, nothing is updated.
  const updated = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: {
      status: change.to,
      ...(change.to === "SHIPPED"
        ? { courier: change.courier?.trim() || null, trackingNo: change.trackingNo?.trim() || null }
        : {}),
    },
  });
  if (updated.count !== 1) throw new OrderActionError("This order was just changed by someone else. Reload and try again.");

  if (restocksOn(change.to)) {
    await restockOrder(tx, orderId, change.actorId, `Order ${STATUS_LABEL[change.to].toLowerCase()}`);
    if (order.couponId) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    }
  }

  await tx.orderEvent.create({
    data: {
      orderId,
      type: "status",
      fromStatus: from,
      toStatus: change.to,
      message: change.message?.trim() || null,
      actorId: change.actorId,
    },
  });
  await tx.activityLog.create({
    data: {
      actorId: change.actorId,
      action: "order.status",
      entity: "order",
      entityId: orderId,
      details: { from, to: change.to },
    },
  });
}

export async function changeStatus(orderId: string, change: StatusChange): Promise<void> {
  await db.$transaction((tx) => changeStatusInTx(tx, orderId, change));
}

/** Applies one status to many orders; each order succeeds or fails on its own. */
export async function bulkChangeStatus(orderIds: string[], change: StatusChange) {
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const id of orderIds.slice(0, 200)) {
    try {
      await changeStatus(id, change);
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, error: error instanceof Error ? error.message : "Failed." });
    }
  }
  return results;
}

export async function addOrderNote(orderId: string, actorId: string, note: string): Promise<void> {
  const text = note.trim().slice(0, 2000);
  if (!text) throw new OrderActionError("Write a note first.");
  await db.orderEvent.create({ data: { orderId, type: "note", message: text, actorId } });
}

/**
 * Creates a print batch. scope "new" takes every PENDING order (oldest first);
 * otherwise the given ids. Pending orders in the batch move to PROCESSING in
 * the same transaction; orders already past PENDING are reprinted unchanged.
 */
export async function createPrintBatch(
  actorId: string,
  scope: { kind: "new" } | { kind: "ids"; ids: string[] },
): Promise<{ batchId: number; count: number; moved: number }> {
  return db.$transaction(async (tx) => {
    const orders = await tx.order.findMany({
      where:
        scope.kind === "new"
          ? { status: "PENDING" }
          : { id: { in: scope.ids.slice(0, 400) }, status: { notIn: ["CANCELLED", "RETURNED"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true },
      take: 400,
    });
    if (!orders.length) {
      throw new OrderActionError(scope.kind === "new" ? "There are no new orders to print." : "Nothing to print.");
    }

    const batch = await tx.printBatch.create({ data: { createdById: actorId } });
    let moved = 0;
    for (const order of orders) {
      await tx.order.update({ where: { id: order.id }, data: { printBatchId: batch.id, printedAt: new Date() } });
      await tx.orderEvent.create({
        data: { orderId: order.id, type: "print", message: `Slip printed (batch #${batch.id}).`, actorId },
      });
      if (order.status === "PENDING") {
        await changeStatusInTx(tx, order.id, { to: "PROCESSING", actorId });
        moved += 1;
      }
    }
    await tx.activityLog.create({
      data: { actorId, action: "print.batch", entity: "printBatch", entityId: String(batch.id), details: { count: orders.length } },
    });
    return { batchId: batch.id, count: orders.length, moved };
  });
}
