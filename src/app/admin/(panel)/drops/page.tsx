import Link from "next/link";
import { createDropAction } from "@/app/admin/actions/drops";
import { DropForm } from "@/components/admin/DropForm";
import { Empty, PageHeader, Panel, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dropPhase, toPakistanLocal } from "@/lib/drops/rules";

export const metadata = { title: "Drops" };

export default async function DropsPage() {
  await requireAdmin();
  const now = new Date();
  const drops = await db.drop.findMany({
    orderBy: { startsAt: "desc" },
    take: 60,
    include: {
      _count: { select: { products: true } },
      products: { where: { stock: 0 }, select: { id: true } },
    },
  });
  const phaseLabel = { scheduled: "Scheduled", live: "Live", cancelled: "Cancelled" } as const;
  const upcoming = drops.filter((d) => dropPhase(d, now) === "scheduled").reverse();
  const rest = drops.filter((d) => dropPhase(d, now) !== "scheduled");
  const defaultStart = toPakistanLocal(new Date(Math.ceil((now.getTime() + 86_400_000) / 3_600_000) * 3_600_000));

  const row = (d: (typeof drops)[number]) => {
    const phase = dropPhase(d, now);
    return (
      <li key={d.id}>
        <Link href={`/admin/drops/${d.id}`} className="flex items-center justify-between gap-3 border-2 border-ink bg-card p-3 hover:bg-sunken">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{d.name}</span>
            <span className="tag-text text-xs text-muted">
              {pkDateTime.format(d.startsAt)} · {d._count.products} piece{d._count.products === 1 ? "" : "s"}
              {phase === "live" ? ` · ${d.products.length} sold` : ""}
            </span>
          </span>
          <span className={`chip ${phase === "scheduled" ? "chip-solid" : phase === "cancelled" ? "chip-muted line-through" : "chip-dashed"}`}>{phaseLabel[phase]}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Drops" subtitle="Group drafts into a timed release. Pieces go live at the exact minute, and the countdown runs in the shop's top bar." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="label mb-2">Coming up</h2>
            {upcoming.length ? <ul className="flex flex-col gap-2">{upcoming.map(row)}</ul> : <Empty>No drops scheduled.</Empty>}
          </section>
          {rest.length > 0 && (
            <section>
              <h2 className="label mb-2">Past</h2>
              <ul className="flex flex-col gap-2">{rest.map(row)}</ul>
            </section>
          )}
        </div>
        <Panel title="New drop">
          <DropForm
            action={createDropAction}
            submitLabel="Create drop, then add pieces"
            values={{ name: "", description: "", startsAt: defaultStart, coverKey: null, showPreview: true, announce: true }}
          />
        </Panel>
      </div>
    </>
  );
}
