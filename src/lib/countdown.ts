// Countdown maths for the announcement bar and drop pages. The page sends the
// server's clock; the client keeps an offset so a wrong phone clock cannot make
// the countdown lie about when a drop opens.

export interface Remaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function remaining(targetMs: number, nowMs: number): Remaining {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "02d 14:03:22", or "14:03:22" under a day. */
export function formatRemaining(r: Remaining): string {
  const clock = `${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`;
  return r.days > 0 ? `${pad(r.days)}d ${clock}` : clock;
}

/** Offset to add to Date.now() on the client to get server time. */
export function clockOffset(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}
