import { removeDeviceAction, testDeviceAction } from "@/app/admin/actions/team";
import { ActionForm } from "@/components/admin/ActionForm";
import { Empty, Notice, PageHeader, Panel, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { pushConfigured } from "@/lib/push/fcm";

export const metadata = { title: "Alert phones" };

const weekAgo = () => new Date(Date.now() - 7 * 86_400_000);

export default async function DevicesPage() {
  const admin = await requireAdmin();
  const [devices, recent] = await Promise.all([
    db.adminDevice.findMany({
      where: admin.role === "OWNER" ? {} : { userId: admin.id },
      orderBy: { lastSeenAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    db.pushDelivery.groupBy({ by: ["state"], where: { createdAt: { gte: weekAgo() } }, _count: true }),
  ]);
  const count = (s: string) => recent.find((r) => r.state === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Alert phones" subtitle="Phones running the order-alert app. Each new order pings every phone here; tapping the alert opens the order." />
      {!pushConfigured() && (
        <Notice>
          Alerts are switched off on this server: set <span className="tag-text">FIREBASE_SERVICE_ACCOUNT_JSON</span> in the hosting environment (see docs/ANDROID.md).
        </Notice>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="flex flex-col gap-3">
          {devices.length ? (
            devices.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-card p-3">
                <div>
                  <p className="font-semibold">{d.label ?? "Phone"}</p>
                  <p className="tag-text text-xs text-muted">
                    {d.user.name} · paired {pkDateTime.format(d.createdAt)} · last seen {pkDateTime.format(d.lastSeenAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={testDeviceAction} submitLabel="Send test" submitClassName="btn btn-line btn-sm" inline>
                    <input type="hidden" name="id" value={d.id} />
                  </ActionForm>
                  <ActionForm action={removeDeviceAction} submitLabel="Remove" submitClassName="btn btn-ghost btn-sm" inline confirm="Stop alerts on this phone?">
                    <input type="hidden" name="id" value={d.id} />
                  </ActionForm>
                </div>
              </div>
            ))
          ) : (
            <Empty>No phones yet. Install the order-alert app, open it, and sign in — it pairs itself.</Empty>
          )}
        </section>
        <Panel title="Last 7 days">
          <dl className="tag-text grid grid-cols-3 gap-2 text-center text-sm">
            {[
              ["Sent", count("SENT")],
              ["Retrying", count("PENDING")],
              ["Failed", count("FAILED")],
            ].map(([label, n]) => (
              <div key={label} className="border-2 border-dashed border-ink p-2">
                <dt className="font-sans text-xs text-muted">{label}</dt>
                <dd className="text-xl font-bold">{n}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">Alerts that fail are retried for about 30 minutes by the server&apos;s 5-minute cron job.</p>
        </Panel>
      </div>
    </>
  );
}
