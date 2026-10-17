import { saveAnnouncementAction, saveHeroAction, savePageAction, saveReviewsAction } from "@/app/admin/actions/site";
import { ActionForm, F } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/DropForm";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";

export const metadata = { title: "Storefront & pages" };

type Page = Awaited<ReturnType<typeof db.page.findMany>>[number];

function PageFields({ p }: { p?: Page }) {
  return (
    <>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem_6rem]">
        <F label="Title">
          <input name="title" required defaultValue={p?.title} className="field" />
        </F>
        <F label="URL slug">
          <input name="slug" defaultValue={p?.slug} className="field tag-text" />
        </F>
        <F label="Order">
          <input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} className="field tag-text" />
        </F>
      </div>
      <F label="Text" hint="Blank line = new paragraph. A short line followed by text becomes a heading (good for FAQs).">
        <textarea name="body" rows={12} defaultValue={p?.body} className="field" />
      </F>
      <div className="flex flex-wrap gap-x-6">
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={p?.isPublished ?? true} className="size-5 accent-ink" /> Published
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="showInFooter" defaultChecked={p?.showInFooter ?? true} className="size-5 accent-ink" /> Link in footer
        </label>
      </div>
    </>
  );
}

export default async function StorefrontPage() {
  await requireAdmin();
  const [settings, pages] = await Promise.all([getSettings(), db.page.findMany({ orderBy: { sortOrder: "asc" } })]);
  const { announcement, hero, proof } = settings;
  const placeholders = pages.filter((p) => p.body.includes("["));

  return (
    <>
      <PageHeader title="Storefront & pages" subtitle="What shoppers see first, and the policy pages linked from the footer." />
      <div className="flex flex-col gap-6">
        <Panel title="Top bar">
          <ActionForm action={saveAnnouncementAction} submitLabel="Save top bar">
            <p className="text-sm text-muted">
              Always starts with “Welcome to {site.name}”. When a drop is scheduled, its countdown is added automatically.
            </p>
            <F label="Message">
              <input name="text" defaultValue={announcement.text} maxLength={160} className="field" />
            </F>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={announcement.enabled} className="size-5 accent-ink" /> Show this message
            </label>
          </ActionForm>
        </Panel>

        <Panel title="Home page hero">
          <ActionForm action={saveHeroAction} submitLabel="Save hero">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <F label="Small label">
                <input name="eyebrow" defaultValue={hero.eyebrow} maxLength={60} className="field" />
              </F>
              <F label="Headline">
                <input name="title" defaultValue={hero.title} maxLength={80} className="field" />
              </F>
            </div>
            <F label="Line under the headline">
              <textarea name="subtitle" defaultValue={hero.subtitle} maxLength={200} rows={2} className="field" />
            </F>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <F label="Button text">
                <input name="ctaLabel" defaultValue={hero.ctaLabel} maxLength={30} className="field" />
              </F>
              <F label="Button link">
                <input name="ctaHref" defaultValue={hero.ctaHref} className="field tag-text" />
              </F>
            </div>
            <ImageField name="imageKey" initial={hero.imageKey} label="Hero photo (optional — without one, the three newest pieces are shown)" />
          </ActionForm>
        </Panel>

        <Panel title="Customer reviews">
          <ActionForm action={saveReviewsAction} submitLabel="Save reviews">
            <p className="text-sm text-muted">
              Only real reviews from real customers. One per line: <span className="tag-text">Name | City | What they said</span>. Leave empty to hide the section.
            </p>
            <textarea
              name="reviews"
              rows={6}
              className="field"
              defaultValue={proof.reviews.map((r) => `${r.name} | ${r.city} | ${r.text}`).join("\n")}
              aria-label="Reviews"
            />
          </ActionForm>
        </Panel>

        <section className="flex flex-col gap-3">
          <h2 className="label">Pages</h2>
          {placeholders.length > 0 && (
            <p className="border-2 border-dashed border-ink bg-card p-3 text-sm">
              {placeholders.length} page(s) still contain [bracketed] placeholder text: {placeholders.map((p) => p.title).join(", ")}. Fill them in before launch.
            </p>
          )}
          {pages.map((p) => (
            <details key={p.id} className="border-2 border-ink bg-card">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3">
                <span className="font-semibold">{p.title}</span>
                <span className="tag-text text-xs text-muted">
                  /pages/{p.slug}
                  {p.isPublished ? "" : " · draft"}
                </span>
              </summary>
              <div className="border-t-2 border-dashed border-ink p-3">
                <ActionForm action={savePageAction} submitLabel="Save page">
                  <PageFields p={p} />
                </ActionForm>
              </div>
            </details>
          ))}
          <Panel title="New page">
            <ActionForm action={savePageAction} submitLabel="Add page" resetOnSuccess>
              <PageFields />
            </ActionForm>
          </Panel>
        </section>
      </div>
    </>
  );
}
