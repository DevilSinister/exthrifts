import { site } from "@/lib/site";

/**
 * Header/footer lockup: the woven-label tag from /brand (black, or white for
 * dark backgrounds). The artwork spells the brand name, so a rename needs new
 * artwork from brand/build-brand.py; everything else reads the env name.
 */
export function Logo({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG artwork, nothing to optimise
    <img
      src={inverted ? "/brand/tag-white.svg" : "/brand/tag.svg"}
      alt={site.name}
      width={389}
      height={120}
      className={className}
      decoding="async"
    />
  );
}
