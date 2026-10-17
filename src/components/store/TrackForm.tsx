"use client";

import { useActionState } from "react";
import { trackOrderAction, type TrackResult } from "@/app/(store)/actions";

export function TrackForm() {
  const [state, action, pending] = useActionState<TrackResult, FormData>(trackOrderAction, {});
  return (
    <>
      <form action={action} className="mt-6 flex flex-col gap-4 border-2 border-ink bg-card p-5">
        <label className="flex flex-col gap-1.5">
          <span className="label text-[0.8125rem]">Order number</span>
          <input name="order" required placeholder="EXT-1001" autoComplete="off" className="field tag-text uppercase" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label text-[0.8125rem]">Phone number</span>
          <input name="phone" type="tel" inputMode="tel" required placeholder="03XX XXXXXXX" autoComplete="tel" className="field tag-text" />
        </label>
        <button type="submit" className="btn btn-ink" disabled={pending}>
          {pending ? "Looking…" : "Track order"}
        </button>
        {state.error && (
          <p className="text-sm font-bold" role="alert">
            ! {state.error}
          </p>
        )}
      </form>

      {state.order && (
        <section className="mt-8 border-2 border-ink bg-card p-5" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label text-muted">Order {state.order.label}</p>
              <p className="display mt-1 text-4xl">{state.order.status}</p>
            </div>
            <p className="tag-text text-right text-sm text-muted">Placed {state.order.placedAt}</p>
          </div>
          {(state.order.courier || state.order.trackingNo) && (
            <p className="tag-text mt-4 border-2 border-dashed border-ink p-3 text-sm">
              {state.order.courier}
              {state.order.trackingNo ? ` · tracking ${state.order.trackingNo}` : ""}
            </p>
          )}
          <ol className="mt-5 flex flex-col gap-3 border-l-2 border-dashed border-ink pl-4">
            {state.order.events.map((e, i) => (
              <li key={i} className="relative">
                <span aria-hidden className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-ink" />
                <p className="font-semibold">{e.text}</p>
                <p className="tag-text text-xs text-muted">{e.at}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
