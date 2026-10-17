// The order workflow. Every status change in the app goes through canTransition,
// so bulk actions, the order page and slip printing obey the same rules.

export const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURNED",
] as const;

export type OrderStatusName = (typeof ORDER_STATUSES)[number];

const ALLOWED: Record<OrderStatusName, readonly OrderStatusName[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};

export const STATUS_LABEL: Record<OrderStatusName, string> = {
  PENDING: "New",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

export function isOrderStatus(value: unknown): value is OrderStatusName {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function nextStatuses(from: OrderStatusName): readonly OrderStatusName[] {
  return ALLOWED[from];
}

export function canTransition(from: OrderStatusName, to: OrderStatusName): boolean {
  return ALLOWED[from].includes(to);
}

/** Cancelling or taking back a parcel puts the pieces back on sale. */
export function restocksOn(to: OrderStatusName): boolean {
  return to === "CANCELLED" || to === "RETURNED";
}

export interface TransitionInput {
  courier?: string | null;
  trackingNo?: string | null;
}

/** Returns an error message when the target status needs details that are missing. */
export function missingForTransition(to: OrderStatusName, input: TransitionInput): string | null {
  if (to === "SHIPPED" && !input.courier?.trim()) return "Choose the courier before marking as shipped.";
  return null;
}
