// next/image loader. Uploaded photos are stored as fixed-width WebP variants
// (<key>-400.webp, -800, -1600) and referenced as "/media/<key>"; this picks
// the smallest variant that covers the requested width. Other sources
// (static files under /brand etc.) are returned unchanged.

export const IMAGE_WIDTHS = [400, 800, 1600] as const;

export function pickWidth(requested: number): number {
  return IMAGE_WIDTHS.find((w) => w >= requested) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}

export function mediaSrc(key: string): string {
  return `/media/${key}`;
}

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith("/media/")) return `${src}-${pickWidth(width)}.webp`;
  return src;
}
