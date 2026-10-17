// Pure rules for order alerts: payload shape, retry timing and how FCM errors
// are classified. The sender (fcm.ts) and the outbox (outbox.ts) use these.

export const MAX_PUSH_ATTEMPTS = 5;
const BASE_DELAY_SECONDS = 60;
const MAX_DELAY_SECONDS = 900;

/**
 * Seconds to wait before the next attempt. The exponent is clamped BEFORE the
 * multiplication: Us Together's queue died when 60 * 2^attempts overflowed
 * before the cap was applied.
 */
export function retryDelaySeconds(attempts: number): number {
  const exponent = Math.min(Math.max(Math.trunc(attempts), 0), 4);
  return Math.min(BASE_DELAY_SECONDS * 2 ** exponent, MAX_DELAY_SECONDS);
}

export type FcmOutcome = "sent" | "unregistered" | "retry" | "fatal";

/**
 * Only a typed UNREGISTERED error removes a device. Generic 4xx/5xx, IAM and
 * quota errors are retried or failed, never treated as a dead token.
 */
export function classifyFcmResponse(status: number, body: unknown): FcmOutcome {
  if (status >= 200 && status < 300) return "sent";
  const details = (body as { error?: { details?: Array<{ errorCode?: string }> } })?.error?.details ?? [];
  if (details.some((d) => d?.errorCode === "UNREGISTERED")) return "unregistered";
  if (status === 429 || status >= 500) return "retry";
  return "fatal";
}

/** Notification taps may only open admin pages on this site. */
export function isSafeAdminPath(path: string): boolean {
  return /^\/admin(\/[A-Za-z0-9_\-/]*)?$/.test(path) && !path.includes("//");
}

export interface OrderAlertInput {
  orderId: string;
  orderLabel: string;
  customerName: string;
  city: string;
  itemCount: number;
  totalLabel: string;
  siteName: string;
}

/** FCM data payload (all values must be strings). */
export function orderAlertPayload(input: OrderAlertInput): Record<string, string> {
  const pieces = input.itemCount === 1 ? "1 piece" : `${input.itemCount} pieces`;
  return {
    type: "order",
    orderId: input.orderId,
    number: input.orderLabel,
    title: `New order ${input.orderLabel} · ${input.totalLabel}`.slice(0, 120),
    body: `${input.customerName}, ${input.city} — ${pieces}`.slice(0, 240),
    targetPath: `/admin/orders/${input.orderId}`,
    tag: `order-${input.orderId}`,
    site: input.siteName,
  };
}
