import { Empty, PageHeader, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Activity" };

const LABELS: Record<string, string> = {
  "order.status": "changed an order's status",
  "print.batch": "printed slips",
  "product.create": "added a piece",
  "product.update": "edited a piece",
  "product.duplicate": "duplicated a piece",
  "drop.create": "created a drop",
  "drop.update": "edited a drop",
  "drop.add": "added pieces to a drop",
  "drop.remove": "took a piece out of a drop",
  "drop.live": "launched a drop early",
  "drop.cancel": "cancelled a drop",
  "settings.store": "changed store details",
  "settings.shipping": "changed delivery settings",
  "team.add": "added a team member",
  "team.update": "changed a team member's access",
  "team.password": "reset a password",
  "device.paired": "paired a phone for alerts",
};

export default async function ActivityPage() {
  await requireAdmin();
  const logs = await db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 150, include: { actor: { select: { name: true } } } });
  return (
    <>
      <PageHeader title="Activity" subtitle="The last 150 changes made in the back office." />
      {logs.length ? (
        <ol className="flex flex-col border-2 border-ink bg-card">
          {logs.map((log, i) => {
            const details = (log.details ?? {}) as Record<string, unknown>;
            const extra = [details.title, details.name, details.code, details.from && details.to ? `${details.from} → ${details.to}` : null, details.count ? `${details.count}` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={log.id} className={`flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm ${i ? "border-t border-dashed border-rule" : ""}`}>
                <span>
                  <strong>{log.actor?.name ?? "System"}</strong> {LABELS[log.action] ?? log.action}
                  {extra && <span className="text-muted"> — {extra}</span>}
                </span>
                <span className="tag-text text-xs text-muted">{pkDateTime.format(log.createdAt)}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <Empty>Nothing yet.</Empty>
      )}
    </>
  );
}
