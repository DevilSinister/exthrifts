import { deleteCategoryAction, deleteCollectionAction, saveCategoryAction, saveCollectionAction } from "@/app/admin/actions/catalog";
import { ActionForm, F } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/DropForm";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Categories & collections" };

type Category = { id: string; name: string; slug: string; description: string | null; parentId: string | null; sortOrder: number; showInMenu: boolean; imageKey: string | null };
type Collection = { id: string; name: string; slug: string; description: string | null; isActive: boolean; showOnHome: boolean; sortOrder: number };

function CategoryFields({ c, parents }: { c?: Category; parents: Array<{ id: string; name: string }> }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Name">
          <input name="name" required defaultValue={c?.name} className="field" />
        </F>
        <F label="URL slug" hint="Empty = from name">
          <input name="slug" defaultValue={c?.slug} className="field tag-text" />
        </F>
        <F label="Inside">
          <select name="parentId" defaultValue={c?.parentId ?? ""} className="field">
            <option value="">Top level (shows in the menu)</option>
            {parents.filter((p) => p.id !== c?.id).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Order">
          <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="field tag-text" />
        </F>
      </div>
      <F label="Intro text (optional)">
        <textarea name="description" rows={2} defaultValue={c?.description ?? ""} className="field" />
      </F>
      <ImageField name="imageKey" initial={c?.imageKey ?? null} label="Tile photo (optional — otherwise the newest piece)" />
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="showInMenu" defaultChecked={c?.showInMenu ?? true} className="size-5 accent-ink" /> Show in the shop menu
      </label>
    </>
  );
}

function CollectionFields({ c }: { c?: Collection }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Name">
          <input name="name" required defaultValue={c?.name} className="field" />
        </F>
        <F label="URL slug">
          <input name="slug" defaultValue={c?.slug} className="field tag-text" />
        </F>
      </div>
      <F label="Intro text (optional)">
        <textarea name="description" rows={2} defaultValue={c?.description ?? ""} className="field" />
      </F>
      <div className="flex flex-wrap gap-x-6">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="size-5 accent-ink" /> Active
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="showOnHome" defaultChecked={c?.showOnHome ?? false} className="size-5 accent-ink" /> Show a row on the home page
        </label>
      </div>
      <F label="Order">
        <input name="sortOrder" type="number" defaultValue={c?.sortOrder ?? 0} className="field tag-text w-28" />
      </F>
    </>
  );
}

export default async function CatalogPage() {
  await requireAdmin();
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } }),
    db.collection.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  const parents = categories.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title="Categories & collections" subtitle="Categories are the racks in the menu. Collections are hand-picked sets like “Rarest grails”." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="label">Categories</h2>
          {categories.map((c) => (
            <details key={c.id} className="border-2 border-ink bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3">
                <span className="font-semibold">
                  {c.parentId ? "↳ " : ""}
                  {c.name}
                </span>
                <span className="tag-text text-xs text-muted">
                  {c._count.products} pieces{c.showInMenu ? "" : " · hidden from menu"}
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t-2 border-dashed border-ink p-3">
                <ActionForm action={saveCategoryAction} submitLabel="Save category">
                  <CategoryFields c={c} parents={parents} />
                </ActionForm>
                <ActionForm action={deleteCategoryAction} submitLabel="Delete category" submitClassName="btn btn-ghost btn-sm" confirm={`Delete ${c.name}?`}>
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            </details>
          ))}
          <Panel title="Add a category">
            <ActionForm action={saveCategoryAction} submitLabel="Add category" resetOnSuccess>
              <CategoryFields parents={parents} />
            </ActionForm>
          </Panel>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="label">Collections</h2>
          {collections.map((c) => (
            <details key={c.id} className="border-2 border-ink bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3">
                <span className="font-semibold">{c.name}</span>
                <span className="tag-text text-xs text-muted">
                  {c._count.products} pieces{c.isActive ? "" : " · off"}
                  {c.showOnHome ? " · on home" : ""}
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t-2 border-dashed border-ink p-3">
                <ActionForm action={saveCollectionAction} submitLabel="Save collection">
                  <CollectionFields c={c} />
                </ActionForm>
                <ActionForm action={deleteCollectionAction} submitLabel="Delete collection" submitClassName="btn btn-ghost btn-sm" confirm={`Delete ${c.name}? Pieces stay.`}>
                  <input type="hidden" name="id" value={c.id} />
                </ActionForm>
              </div>
            </details>
          ))}
          <Panel title="Add a collection">
            <ActionForm action={saveCollectionAction} submitLabel="Add collection" resetOnSuccess>
              <CollectionFields />
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
