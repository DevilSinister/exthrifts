// Order-alert outbox. A new order writes one PushDelivery per paired admin
// phone and tries to send at once; anything that fails waits for the cron
// endpoint (/api/cron/push), which retries with a bounded backoff.
import { db } from "@/lib/db";
import { formatRs } from "@/lib/money";
import { sendDataMessage, pushConfigured } from "@/lib/push/fcm";
import { MAX_PUSH_ATTEMPTS, orderAlertPayload, retryDelaySeconds } from "@/lib/push/rules";
import { formatOrderNumber, site } from "@/lib/site";

export async function enqueueOrderAlert(orderId: string): Promise<number> {
  const [order, devices] = await Promise.all([
    db.order.findUnique({
      where: { id: orderId },
      select: { id: true, number: true, customerName: true, city: true, total: true, _count: { select: { items: true } } },
    }),
    db.adminDevice.findMany({ where: { user: { isActive: true } }, select: { id: true } }),
  ]);
  if (!order || !devices.length) return 0;

  const payload = orderAlertPayload({
    orderId: order.id,
    orderLabel: formatOrderNumber(order.number),
    customerName: order.customerName,
    city: order.city,
    itemCount: order._count.items,
    totalLabel: formatRs(order.total),
    siteName: site.name,
  });

  // skipDuplicates keeps a retried enqueue from double-alerting (unique orderId+deviceId).
  const created = await db.pushDelivery.createMany({
    data: devices.map((d) => ({ orderId: order.id, deviceId: d.id, payload })),
    skipDuplicates: true,
  });
  return created.count;
}

async function attempt(delivery: {
  id: string;
  attempts: number;
  payload: unknown;
  device: { id: string; token: string };
}): Promise<"sent" | "retry" | "failed" | "removed"> {
  const attempts = delivery.attempts + 1;
  const result = await sendDataMessage(delivery.device.token, delivery.payload as Record<string, string>);

  if (result.outcome === "sent") {
    await db.pushDelivery.update({
      where: { id: delivery.id },
      data: { state: "SENT", attempts, sentAt: new Date(), lastError: null },
    });
    await db.adminDevice.update({ where: { id: delivery.device.id }, data: { lastSeenAt: new Date() } });
    return "sent";
  }
  if (result.outcome === "unregistered") {
    // The app was uninstalled or its token rotated: drop the device (cascades its deliveries).
    await db.adminDevice.delete({ where: { id: delivery.device.id } }).catch(() => undefined);
    return "removed";
  }
  const giveUp = result.outcome === "fatal" || attempts >= MAX_PUSH_ATTEMPTS;
  await db.pushDelivery.update({
    where: { id: delivery.id },
    data: {
      state: giveUp ? "FAILED" : "PENDING",
      attempts,
      lastError: result.code.slice(0, 120),
      nextAttemptAt: new Date(Date.now() + retryDelaySeconds(attempts) * 1000),
    },
  });
  return giveUp ? "failed" : "retry";
}

/** Sends due deliveries. Called right after an order and by the cron endpoint. */
export async function dispatchDue(limit = 50, orderId?: string) {
  const summary = { sent: 0, retry: 0, failed: 0, removed: 0, skipped: false };
  if (!pushConfigured()) {
    summary.skipped = true;
    return summary;
  }
  const due = await db.pushDelivery.findMany({
    where: { state: "PENDING", nextAttemptAt: { lte: new Date() }, ...(orderId ? { orderId } : {}) },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true, attempts: true, payload: true, device: { select: { id: true, token: true } } },
  });
  for (const delivery of due) {
    // Claim the row so an overlapping cron run doesn't send it twice.
    const claimed = await db.pushDelivery.updateMany({
      where: { id: delivery.id, state: "PENDING", attempts: delivery.attempts },
      data: { nextAttemptAt: new Date(Date.now() + 120_000) },
    });
    if (claimed.count !== 1) continue;
    summary[await attempt(delivery)] += 1;
  }
  return summary;
}

/** "Send test" from the Devices page: one delivery, no order. */
export async function sendTestAlert(deviceId: string): Promise<string> {
  const device = await db.adminDevice.findUnique({ where: { id: deviceId } });
  if (!device) return "Device not found.";
  if (!pushConfigured()) return "Push isn't configured: set FIREBASE_SERVICE_ACCOUNT_JSON on the server.";
  const result = await sendDataMessage(device.token, {
    type: "test",
    title: `${site.name}: test alert`,
    body: "Order alerts are working on this phone.",
    targetPath: "/admin/orders",
    tag: `test-${Date.now()}`,
    site: site.name,
  });
  if (result.outcome === "unregistered") {
    await db.adminDevice.delete({ where: { id: device.id } });
    return "This phone's app is no longer registered. It has been removed; open the app again to re-pair.";
  }
  return result.outcome === "sent" ? "Test alert sent." : `Couldn't send (${result.code}).`;
}
