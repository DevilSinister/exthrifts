"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Scope = { kind: "new" } | { kind: "ids"; ids: string[] };

function download(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Creates a print batch on the server (which moves New orders to Processing in
 * the same transaction), then downloads its PDF. If the download fails, the
 * batch is still listed under Print history and can be downloaded again.
 */
function usePrint() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function print(scope: Scope) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/print-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope),
      });
      const body = (await res.json().catch(() => ({}))) as { batchId?: number; count?: number; moved?: number; error?: string };
      if (!res.ok || !body.batchId) {
        setMessage(body.error ?? "Couldn't create the slips. Try again.");
        return;
      }
      download(`/api/admin/print-batches/${body.batchId}/pdf`);
      setMessage(
        `${body.count} slip${body.count === 1 ? "" : "s"} downloading` +
          (body.moved ? ` · ${body.moved} moved to Processing` : "") +
          `. Batch #${body.batchId} is in Print history.`,
      );
      router.refresh();
    } catch {
      setMessage("Network problem — nothing was printed. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return { print, busy, message };
}

function Message({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span role="status" className="text-sm">
      {text}
    </span>
  );
}

export function PrintNewButton({ count, inverted = false }: { count: number; inverted?: boolean }) {
  const { print, busy, message } = usePrint();
  return (
    <span className="flex flex-col gap-2">
      <button
        type="button"
        className={inverted ? "btn border-paper bg-paper text-ink hover:bg-sunken" : "btn btn-ink"}
        disabled={busy || count === 0}
        onClick={() => {
          if (window.confirm(`Print ${count} slip${count === 1 ? "" : "s"} and move ${count === 1 ? "it" : "them"} to Processing?`)) {
            void print({ kind: "new" });
          }
        }}
      >
        {busy ? "Preparing PDF…" : `Print new orders (${count})`}
      </button>
      <Message text={message} />
    </span>
  );
}

export function PrintSelectedButton({ ids }: { ids: string[] }) {
  const { print, busy, message } = usePrint();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-line btn-sm" disabled={busy || ids.length === 0} onClick={() => void print({ kind: "ids", ids })}>
        {busy ? "Preparing…" : `Print ${ids.length} selected`}
      </button>
      <Message text={message} />
    </span>
  );
}

export function PrintOneButton({ orderId, label = "Print slip" }: { orderId: string; label?: string }) {
  const { print, busy, message } = usePrint();
  return (
    <span className="flex flex-col gap-1">
      <button type="button" className="btn btn-line" disabled={busy} onClick={() => void print({ kind: "ids", ids: [orderId] })}>
        {busy ? "Preparing…" : label}
      </button>
      <Message text={message} />
    </span>
  );
}
