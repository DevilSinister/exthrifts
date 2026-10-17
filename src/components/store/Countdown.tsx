"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clockOffset, remaining } from "@/lib/countdown";

const pad = (n: number) => String(n).padStart(2, "0");

/** Big split-flap style countdown for drop pages and the home drop panel. */
export function Countdown({ targetMs, serverNowMs, size = "lg" }: { targetMs: number; serverNowMs: number; size?: "lg" | "md" }) {
  const router = useRouter();
  const [offset] = useState(() => clockOffset(serverNowMs, Date.now()));
  const [now, setNow] = useState(serverNowMs);

  useEffect(() => {
    let refreshed = false;
    const tick = () => {
      const current = Date.now() + offset;
      setNow(current);
      if (current >= targetMs && !refreshed) {
        refreshed = true;
        router.refresh();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [offset, targetMs, router]);

  const r = remaining(targetMs, now);
  const cells: Array<[string, string]> = [
    [pad(r.days), "days"],
    [pad(r.hours), "hrs"],
    [pad(r.minutes), "min"],
    [pad(r.seconds), "sec"],
  ];
  const digit = size === "lg" ? "text-5xl sm:text-7xl" : "text-3xl sm:text-4xl";

  return (
    <div role="timer" aria-live="off" aria-label={`${r.days} days ${r.hours} hours ${r.minutes} minutes`} className="flex gap-2 sm:gap-3">
      {cells.map(([value, unit]) => (
        <div key={unit} className="flex min-w-0 flex-1 flex-col items-center border-2 border-ink bg-card px-2 py-2 sm:px-4">
          <span className={`tag-text font-bold leading-none tabular-nums ${digit}`} suppressHydrationWarning>
            {value}
          </span>
          <span className="label mt-1 text-[0.6875rem] text-muted">{unit}</span>
        </div>
      ))}
    </div>
  );
}
