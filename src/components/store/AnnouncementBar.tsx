"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clockOffset, formatRemaining, remaining } from "@/lib/countdown";

interface DropRef {
  name: string;
  slug: string;
  startsAtMs: number;
}

/**
 * The top bar: "Welcome to {site}" scrolling on the right, and — when a drop is
 * announced — a fixed countdown on the left that never scrolls, so the numbers
 * stay readable. Time comes from the server clock plus an offset, so a phone
 * with the wrong time still counts down to the real start.
 */
export function AnnouncementBar({
  siteName,
  text,
  nextDrop,
  liveDrop,
  serverNowMs,
}: {
  siteName: string;
  text: string | null;
  nextDrop: DropRef | null;
  liveDrop: DropRef | null;
  serverNowMs: number;
}) {
  const router = useRouter();
  const [offset] = useState(() => clockOffset(serverNowMs, Date.now()));
  const [now, setNow] = useState(serverNowMs);

  useEffect(() => {
    if (!nextDrop) return;
    let refreshed = false;
    const tick = () => {
      const current = Date.now() + offset;
      setNow(current);
      if (current >= nextDrop.startsAtMs && !refreshed) {
        // The drop just opened: re-render the page once so its pieces appear.
        refreshed = true;
        router.refresh();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [nextDrop, offset, router]);

  const counting = nextDrop && now < nextDrop.startsAtMs;
  const justOpened = nextDrop && now >= nextDrop.startsAtMs ? nextDrop : liveDrop;
  const clock = counting ? formatRemaining(remaining(nextDrop.startsAtMs, now)) : null;

  const phrases = useMemo(
    () => [`Welcome to ${siteName}`, text, "Every piece is one of one", "Cash on delivery across Pakistan"].filter(Boolean) as string[],
    [siteName, text],
  );

  return (
    <div className="relative z-40 flex h-9 items-stretch bg-ink text-paper">
      {counting && (
        <Link
          href={`/drops/${nextDrop.slug}`}
          className="flex shrink-0 items-center gap-2 border-r border-dashed border-paper/40 px-3 hover:bg-ink-soft"
          aria-label={`Next drop: ${nextDrop.name}, starts in ${clock}`}
        >
          <span className="label text-[0.6875rem]">Next drop</span>
          <span className="tag-text text-[0.8125rem] font-bold tabular-nums" aria-hidden suppressHydrationWarning>
            {clock}
          </span>
        </Link>
      )}
      {!counting && justOpened && (
        <Link
          href={`/drops/${justOpened.slug}`}
          className="flex shrink-0 items-center gap-2 border-r border-dashed border-paper/40 bg-paper px-3 text-ink"
        >
          <span className="label text-[0.6875rem]">Live now</span>
          <span className="max-w-[9rem] truncate text-[0.8125rem] font-semibold">{justOpened.name}</span>
        </Link>
      )}
      <div className="marquee relative min-w-0 flex-1 overflow-hidden" aria-label={phrases.join(". ")}>
        <div className="marquee-track flex h-full w-max items-center" aria-hidden>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center">
              {[...phrases, ...phrases].map((phrase, i) => (
                <span key={`${copy}-${i}`} className="flex items-center whitespace-nowrap px-5 label text-[0.6875rem]">
                  {phrase}
                  <span className="ml-10 inline-block size-1 rounded-full bg-paper/60" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
