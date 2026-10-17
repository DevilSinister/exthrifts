"use client";

import Image from "next/image";
import { useState } from "react";
import { ActionForm, F } from "@/components/admin/ActionForm";
import type { ActionState } from "@/lib/admin-action";
import { mediaSrc } from "@/lib/images/loader";

/** Single image picker that uploads immediately and submits its key in a hidden input. */
export function ImageField({ name, initial, label, folder = "site" }: { name: string; initial: string | null; label: string; folder?: "site" | "product" }) {
  const [key, setKey] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("folder", folder);
    try {
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
      if (!res.ok || !json.key) setError(json.error ?? "Upload failed.");
      else setKey(json.key);
    } catch {
      setError("Network problem, try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="label text-[0.75rem]">{label}</span>
      <input type="hidden" name={name} value={key ?? ""} />
      <div className="flex items-center gap-3">
        <div className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden border-2 border-ink bg-sunken">
          {key && <Image src={mediaSrc(key)} alt="" fill sizes="112px" className="object-cover" />}
        </div>
        <div className="flex flex-col gap-2">
          <label className="btn btn-line btn-sm cursor-pointer">
            {busy ? "Uploading…" : key ? "Replace" : "Upload"}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          {key && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setKey(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <span className="text-sm font-bold">! {error}</span>}
    </div>
  );
}

export interface DropValues {
  id?: string;
  name: string;
  description: string;
  startsAt: string; // datetime-local, Pakistan time
  coverKey: string | null;
  showPreview: boolean;
  announce: boolean;
}

export function DropForm({
  action,
  values,
  submitLabel,
  timeLocked = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  values: DropValues;
  submitLabel: string;
  timeLocked?: boolean;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <F label="Name">
        <input name="name" required defaultValue={values.name} className="field" placeholder="e.g. Friday night drop" />
      </F>
      <F label="Goes live (Pakistan time)" hint={timeLocked ? "The drop has started; its time can't change." : "Pieces appear at exactly this minute."}>
        <input name="startsAt" type="datetime-local" required defaultValue={values.startsAt} disabled={timeLocked} className="field tag-text" />
      </F>
      <F label="Description (optional)">
        <textarea name="description" rows={3} defaultValue={values.description} className="field" placeholder="What's in it, in one line." />
      </F>
      <ImageField name="coverKey" initial={values.coverKey} label="Cover photo (optional)" />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="announce" defaultChecked={values.announce} className="size-5 accent-ink" />
        Count down in the shop&apos;s top bar
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="showPreview" defaultChecked={values.showPreview} className="size-5 accent-ink" />
        Show the pieces on the drop page before launch (they can&apos;t be bought until then)
      </label>
    </ActionForm>
  );
}
