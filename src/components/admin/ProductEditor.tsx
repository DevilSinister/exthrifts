"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { saveProductAction } from "@/app/admin/actions/products";
import { F } from "@/components/admin/ActionForm";
import type { ActionState } from "@/lib/admin-action";
import { mediaSrc } from "@/lib/images/loader";

export interface EditorImage {
  key: string;
  alt: string;
  width: number;
  height: number;
}

export interface EditorProduct {
  id?: string;
  title: string;
  slug: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "HIDDEN";
  price: number | null;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number;
  size: string;
  measurements: Record<string, number>;
  conditionGrade: number | null;
  conditionNotes: string;
  brand: string;
  era: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  categoryId: string;
  collectionIds: string[];
  images: EditorImage[];
  dropName: string | null;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "One size"];
const MEASURES: Array<[string, string]> = [
  ["chest", "Chest (pit to pit)"],
  ["length", "Length"],
  ["shoulder", "Shoulder"],
  ["sleeve", "Sleeve"],
  ["waist", "Waist"],
  ["inseam", "Inseam"],
];

function PhotoManager({ images, onChange }: { images: EditorImage[]; onChange: (next: EditorImage[]) => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    let next = [...images];
    const list = Array.from(files).slice(0, 12 - images.length);
    for (const [i, file] of list.entries()) {
      setUploading(`Uploading ${i + 1} of ${list.length}…`);
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch("/api/admin/uploads", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as Partial<EditorImage> & { error?: string };
        if (!res.ok || !json.key) {
          setError(`${file.name}: ${json.error ?? "upload failed"}`);
          continue;
        }
        next = [...next, { key: json.key, alt: "", width: json.width!, height: json.height! }];
        onChange(next);
      } catch {
        setError(`${file.name}: network problem, try again.`);
      }
    }
    setUploading(null);
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {images.length > 0 && (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.key} className="flex flex-col border-2 border-ink bg-card">
              <div className="relative aspect-[4/5] bg-sunken">
                <Image src={mediaSrc(img.key)} alt={img.alt} fill sizes="200px" className="object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 bg-ink px-1.5 label text-[0.625rem] text-paper">Cover</span>}
              </div>
              <input
                aria-label={`Describe photo ${i + 1}`}
                placeholder="Describe (e.g. back print)"
                value={img.alt}
                onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
                className="w-full border-t-2 border-dashed border-ink px-2 py-2 text-sm"
              />
              <div className="flex border-t-2 border-ink">
                <button type="button" className="btn btn-ghost btn-sm flex-1 rounded-none px-0" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move earlier">
                  ←
                </button>
                <button type="button" className="btn btn-ghost btn-sm flex-1 rounded-none px-0" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label="Move later">
                  →
                </button>
                <button type="button" className="btn btn-ghost btn-sm flex-1 rounded-none px-0" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {images.length < 12 && (
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed border-ink bg-card p-4 text-center hover:bg-sunken">
          <span className="label">{uploading ?? "Add photos"}</span>
          <span className="text-xs text-muted">Take photos or choose from your gallery · up to 12 · first one is the cover</span>
          <input type="file" accept="image/*" multiple className="sr-only" disabled={Boolean(uploading)} onChange={(e) => void upload(e.target.files).then(() => (e.target.value = ""))} />
        </label>
      )}
      {error && (
        <p className="text-sm font-bold" role="alert">
          ! {error}
        </p>
      )}
    </div>
  );
}

export function ProductEditor({
  product,
  categories,
  collections,
}: {
  product: EditorProduct;
  categories: Array<{ id: string; name: string }>;
  collections: Array<{ id: string; name: string }>;
}) {
  const [images, setImages] = useState<EditorImage[]>(product.images);
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProductAction, {});
  const [status, setStatus] = useState(product.status);

  return (
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
      {product.id && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 border-2 border-ink bg-card p-4">
          <h2 className="label">Photos</h2>
          <PhotoManager images={images} onChange={setImages} />
        </section>

        <section className="flex flex-col gap-4 border-2 border-ink bg-card p-4">
          <h2 className="label">The piece</h2>
          <F label="Title">
            <input name="title" required defaultValue={product.title} className="field" placeholder="90s Harley-Davidson leather jacket" />
          </F>
          <F label="Description" hint="Fit, fabric, flaws, story. Blank lines make paragraphs.">
            <textarea name="description" rows={5} defaultValue={product.description} className="field" />
          </F>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Brand">
              <input name="brand" defaultValue={product.brand} className="field" placeholder="Levi's, Nike, unbranded…" />
            </F>
            <F label="Era">
              <input name="era" defaultValue={product.era} className="field" placeholder="90s, Y2K, 80s…" list="eras" />
            </F>
          </div>
          <datalist id="eras">
            {["70s", "80s", "90s", "Y2K", "00s", "2010s"].map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </section>

        <section className="flex flex-col gap-4 border-2 border-ink bg-card p-4">
          <h2 className="label">Fit &amp; condition</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <F label="Size (as labelled or best fit)">
              <input name="size" defaultValue={product.size} className="field" list="sizes" placeholder="L, 32x30…" />
            </F>
            <F label="Condition (1–10)">
              <input name="conditionGrade" type="number" min={1} max={10} defaultValue={product.conditionGrade ?? ""} className="field tag-text" />
            </F>
          </div>
          <datalist id="sizes">
            {SIZES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <F label="Condition notes" hint="Name every flaw. It builds trust and stops returns.">
            <input name="conditionNotes" defaultValue={product.conditionNotes} className="field" placeholder="Light fading on collar, no holes" />
          </F>
          <fieldset className="min-w-0">
            <legend className="label mb-2 text-[0.75rem]">Measurements, inches, laid flat</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MEASURES.map(([key, label]) => (
                <F key={key} label={label}>
                  <input name={`m_${key}`} type="number" inputMode="decimal" step="0.5" min={0} defaultValue={product.measurements[key] ?? ""} className="field tag-text" />
                </F>
              ))}
            </div>
          </fieldset>
        </section>

        <details className="border-2 border-ink bg-card">
          <summary className="label flex min-h-12 cursor-pointer items-center px-4">Search listing (optional)</summary>
          <div className="flex flex-col gap-4 border-t-2 border-dashed border-ink p-4">
            <F label="URL slug" hint="Leave empty to make one from the title.">
              <input name="slug" defaultValue={product.slug} className="field tag-text" />
            </F>
            <F label="Search title">
              <input name="seoTitle" defaultValue={product.seoTitle} maxLength={200} className="field" />
            </F>
            <F label="Search description">
              <textarea name="seoDescription" defaultValue={product.seoDescription} maxLength={300} rows={2} className="field" />
            </F>
            <F label="Tags" hint="Comma separated: band, team, style…">
              <input name="tags" defaultValue={product.tags} className="field" />
            </F>
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
        <section className="flex flex-col gap-4 border-2 border-ink bg-card p-4">
          <h2 className="label">Price &amp; stock</h2>
          <div className="grid grid-cols-2 gap-3">
            <F label="Price (Rs)">
              <input name="price" required inputMode="numeric" defaultValue={product.price ?? ""} className="field tag-text" />
            </F>
            <F label="Was (Rs)" hint="Shows a sale">
              <input name="compareAtPrice" inputMode="numeric" defaultValue={product.compareAtPrice ?? ""} className="field tag-text" />
            </F>
            <F label="Cost (Rs)" hint="Only you see this">
              <input name="costPrice" inputMode="numeric" defaultValue={product.costPrice ?? ""} className="field tag-text" />
            </F>
            <F label="Stock" hint="1 for a one-of-one">
              <input name="stock" type="number" min={0} defaultValue={product.stock} className="field tag-text" />
            </F>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-2 border-ink bg-card p-4">
          <h2 className="label">Where it shows</h2>
          {product.dropName ? (
            <p className="border-2 border-dashed border-ink p-3 text-sm">
              In the drop <strong>{product.dropName}</strong>. It goes live with the drop; manage it from Drops.
            </p>
          ) : (
            <F label="Status">
              <select name="status" value={status} onChange={(e) => setStatus(e.target.value as EditorProduct["status"])} className="field">
                <option value="DRAFT">Draft — not on the site</option>
                <option value="PUBLISHED">Live — on the site now</option>
                <option value="HIDDEN">Hidden — off the site, kept</option>
              </select>
            </F>
          )}
          <F label="Category">
            <select name="categoryId" defaultValue={product.categoryId} className="field">
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </F>
          {collections.length > 0 && (
            <fieldset className="min-w-0">
              <legend className="label mb-2 text-[0.75rem]">Collections</legend>
              <div className="flex flex-wrap gap-2">
                {collections.map((c) => (
                  <label key={c.id} className="chip cursor-pointer gap-2 px-3 py-1 has-[:checked]:bg-ink has-[:checked]:text-paper">
                    <input type="checkbox" name="collectionIds" value={c.id} defaultChecked={product.collectionIds.includes(c.id)} className="sr-only" />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {!product.dropName && status === "DRAFT" && <p className="text-xs text-muted">Drafts can be added to a scheduled drop from the Drops page.</p>}
        </section>

        <div className="sticky bottom-16 z-20 flex flex-col gap-2 border-2 border-ink bg-paper p-3 md:bottom-0 lg:static">
          <button type="submit" className="btn btn-ink w-full" disabled={pending}>
            {pending ? "Saving…" : product.id ? "Save changes" : "Save piece"}
          </button>
          <p aria-live="polite" className="text-sm">
            {!pending && state.ok && <span className="tag-text">✓ {state.ok}</span>}
            {!pending && state.error && <span className="font-bold">! {state.error}</span>}
          </p>
        </div>
      </div>
    </form>
  );
}
