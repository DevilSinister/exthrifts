// Drop scheduling rules, shared by the admin actions and their tests.

export type DropPhase = "scheduled" | "live" | "cancelled";

export function dropPhase(drop: { startsAt: Date; cancelledAt: Date | null }, now: Date): DropPhase {
  if (drop.cancelledAt) return "cancelled";
  return drop.startsAt.getTime() <= now.getTime() ? "live" : "scheduled";
}

export interface ScheduleCheckInput {
  startsAt: Date;
  productCount: number;
  now: Date;
  /** "Go live now" is allowed to set startsAt to the present. */
  allowNow?: boolean;
}

export function checkSchedule(input: ScheduleCheckInput): string | null {
  if (Number.isNaN(input.startsAt.getTime())) return "Pick a valid date and time.";
  // One minute of grace covers the seconds between filling the form and saving it.
  const graceMs = input.allowNow ? 60_000 : 0;
  if (input.startsAt.getTime() < input.now.getTime() - graceMs) {
    return "The drop time is in the past. Use “Go live now” to launch immediately.";
  }
  if (input.productCount < 1) return "Add at least one product before scheduling the drop.";
  return null;
}

/** A product can be added to a drop only if it is a draft and not in another drop. */
export function canAddToDrop(
  product: { status: string; dropId: string | null },
  dropId: string,
): string | null {
  if (product.dropId && product.dropId !== dropId) return "Already in another drop.";
  if (product.status !== "DRAFT" && product.dropId !== dropId) return "Only draft products can be added to a drop.";
  return null;
}

/**
 * Taking a product out of a drop that is already live would un-publish a piece
 * shoppers can see; refuse once it has been ordered.
 */
export function canRemoveFromDrop(phase: DropPhase, orderCount: number): string | null {
  if (phase === "live" && orderCount > 0) return "This piece has been ordered and can't leave a live drop.";
  return null;
}

/** "2026-11-01T20:00" typed in Pakistan time -> UTC Date. Pakistan has no DST (UTC+5). */
export function parsePakistanLocal(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(Number.NaN);
  const [, y, mo, d, h, mi] = match.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 5, mi));
}

/** UTC Date -> "2026-11-01T20:00" in Pakistan time, for datetime-local inputs. */
export function toPakistanLocal(date: Date): string {
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}
