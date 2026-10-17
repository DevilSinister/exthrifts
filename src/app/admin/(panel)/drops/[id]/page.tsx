import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addToDropAction, cancelDropAction, goLiveNowAction, removeFromDropAction, updateDropAction } from "@/app/admin/actions/drops";
import { ActionForm } from "@/components/admin/ActionForm";
import { DropForm } from "@/components/admin/DropForm";
import { Empty, Notice, PageHeader, Panel, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dropPhase, toPakistanLocal } from "@/lib/drops/rules";
import { mediaSrc } from "@/lib/images/loader";
import { formatRs } from "@/lib/money";

export const metadata = { title: "Drop" };

export default async function DropDetail({ params, searchParams }: PageProps<"/admin/drops/[id]">) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const drop = await db.drop.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { createdAt: "asc" },
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { key: true } }, _count: { select: { orderItems: true } } },
      },
    },
  });
  if (!drop) notFound();
  const now = new Date();
  const phase = dropPhase(drop, now);
  const drafts =
    phase === "scheduled"
      ? await db.product.findMany({
          where: { status: "DRAFT", dropId: null, ...(q ? { OR: [{ title: { contains: q } }, { brand: { contains: q } }] } : {}) },
          orderBy: { updatedAt: "desc" },
          take: 60,
          include: { images: { orderBy: { sortOrder: "asc" }, take: 1, select: { key: true } }, category: { select: { name: true } } },
        })
      : [];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/drops", label: "Drops" }}
        title={drop.name}
        subtitle={
          phase === "scheduled"
            ? `Goes live ${pkDateTime.format(drop.startsAt)} (PKT) · ${drop.products.length} pieces`
            : phase === "live"
              ? `Live since ${pkDateTime.format(drop.startsAt)} · ${drop.products.filter((p) => p.stock === 0).length} of ${drop.products.length} sold`
              : "Cancelled"
        }
        actions={
          <>
            {phase !== "cancelled" && (
              <Link href={`/drops/${drop.slug}`} target="_blank" className="btn btn-line">
                View drop page
              </Link>
            )}
            {phase === "scheduled" && (
              <>
                <ActionForm action={goLiveNowAction} submitLabel="Go live now" inline confirm="Put every piece in this drop on sale right now?">
                  <input type="hidden" name="id" value={drop.id} />
                </ActionForm>
                <ActionForm action={cancelDropAction} submitLabel="Cancel drop" submitClassName="btn btn-ghost" inline confirm="Cancel this drop? Its pieces go back to drafts.">
                  <input type="hidden" name="id" value={drop.id} />
                </ActionForm>
              </>
            )}
          </>
        }
      />
      {sp.created && <Notice>Drop created. Now add the draft pieces it should release.</Notice>}
      {phase === "scheduled" && drop.products.length === 0 && <Notice>This drop has no pieces yet, so the shop doesn&apos;t show its countdown.</Notice>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title={`In this drop (${drop.products.length})`}>
            {drop.products.length ? (
              <ul className="-my-2 divide-y divide-dashed divide-rule">
                {drop.products.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <div className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden bg-sunken">
                      {p.images[0] && <Image src={mediaSrc(p.images[0].key)} alt="" fill sizes="48px" className="object-cover" />}
                    </div>
                    <Link href={`/admin/products/${p.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate text-sm font-semibold">{p.title}</span>
                      <span className="tag-text text-xs text-muted">
                        {[p.size, formatRs(p.price), p.stock === 0 ? "SOLD" : null].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                    {phase !== "cancelled" && !(phase === "live" && p._count.orderItems > 0) && (
                      <ActionForm action={removeFromDropAction} submitLabel="Remove" submitClassName="btn btn-ghost btn-sm" inline>
                        <input type="hidden" name="dropId" value={drop.id} />
                        <input type="hidden" name="productId" value={p.id} />
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No pieces yet.</p>
            )}
          </Panel>

          {phase === "scheduled" && (
            <Panel title="Add drafts">
              <form method="get" className="mb-4 flex gap-2">
                <input name="q" defaultValue={q} placeholder="Search drafts" aria-label="Search drafts" className="field" />
                <button className="btn btn-line" type="submit">
                  Search
                </button>
              </form>
              {drafts.length ? (
                <ActionForm action={addToDropAction} submitLabel="Add selected to drop">
                  <input type="hidden" name="dropId" value={drop.id} />
                  <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto">
                    {drafts.map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 border-2 border-ink bg-card p-2 has-[:checked]:bg-sunken">
                          <input type="checkbox" name="productIds" value={p.id} className="size-5 shrink-0 accent-ink" />
                          <span className="relative aspect-[4/5] w-10 shrink-0 overflow-hidden bg-sunken">
                            {p.images[0] && <Image src={mediaSrc(p.images[0].key)} alt="" fill sizes="40px" className="object-cover" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{p.title}</span>
                            <span className="tag-text text-xs text-muted">{[p.size, p.category?.name, formatRs(p.price)].filter(Boolean).join(" · ")}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </ActionForm>
              ) : (
                <Empty>
                  No drafts{q ? " match" : ""}.{" "}
                  <Link href="/admin/products/new" className="underline underline-offset-4">
                    Add a piece as a draft
                  </Link>
                </Empty>
              )}
            </Panel>
          )}
        </div>

        <Panel title="Details">
          <DropForm
            action={updateDropAction}
            submitLabel="Save drop"
            timeLocked={phase !== "scheduled"}
            values={{
              id: drop.id,
              name: drop.name,
              description: drop.description ?? "",
              startsAt: toPakistanLocal(drop.startsAt),
              coverKey: drop.coverKey,
              showPreview: drop.showPreview,
              announce: drop.announce,
            }}
          />
          <p className="mt-3 text-xs text-muted">Server time now: {pkDateTime.format(now)} PKT</p>
        </Panel>
      </div>
    </>
  );
}
