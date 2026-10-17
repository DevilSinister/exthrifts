// Store identity comes from env so the same code can run under another name or
// domain. Every place that prints the name or builds an absolute URL reads it here.

const DEFAULT_NAME = "ExThrifts";
const DEFAULT_URL = "https://exthrifts.com";

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const site = {
  name: clean(process.env.NEXT_PUBLIC_SITE_NAME) ?? DEFAULT_NAME,
  url: (clean(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_URL).replace(/\/+$/, ""),
  orderPrefix: clean(process.env.NEXT_PUBLIC_ORDER_PREFIX) ?? "EXT",
  timeZone: "Asia/Karachi",
  currency: "PKR",
  locale: "en-PK",
} as const;

export function absoluteUrl(path = "/"): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function siteHost(): string {
  try {
    return new URL(site.url).host;
  } catch {
    return site.url;
  }
}

/** Order numbers start at 1001 for the first order. */
const ORDER_NUMBER_OFFSET = 1000;

export function formatOrderNumber(n: number, prefix: string = site.orderPrefix): string {
  return `${prefix}-${ORDER_NUMBER_OFFSET + n}`;
}

/** Accepts "EXT-1001", "#1001", "1001" or "ext 1001" and returns the stored number. */
export function parseOrderNumber(input: string): number | null {
  const match = input.trim().match(/(\d{4,9})\s*$/);
  if (!match) return null;
  const shown = Number(match[1]);
  const stored = shown - ORDER_NUMBER_OFFSET;
  return Number.isSafeInteger(stored) && stored > 0 ? stored : null;
}
