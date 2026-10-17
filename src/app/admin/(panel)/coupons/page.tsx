import { deleteCouponAction, saveCouponAction } from "@/app/admin/actions/catalog";
import { ActionForm, F } from "@/components/admin/ActionForm";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { toPakistanLocal } from "@/lib/drops/rules";
import { formatRs } from "@/lib/money";

export const metadata = { title: "Coupons" };

type Coupon = Awaited<ReturnType<typeof db.coupon.findMany>>[number];

function describe(c: Coupon) {
  if (c.type === "PERCENT") return `${c.value}% off`;
  if (c.type === "FIXED") return `${formatRs(c.value)} off`;
  return "Free delivery";
}

function state(c: Coupon, now: Date) {
  if (!c.isActive) return "Off";
  if (c.startsAt && c.startsAt > now) return "Scheduled";
  if (c.endsAt && c.endsAt < now) return "Expired";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "Used up";
  return "Active";
}

function CouponFields({ c }: { c?: Coupon }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <F label="Code">
          <input name="code" required defaultValue={c?.code} className="field tag-text uppercase" placeholder="WELCOME10" />
        </F>
        <F label="Type">
          <select name="type" defaultValue={c?.type ?? "PERCENT"} className="field">
            <option value="PERCENT">% off</option>
            <option value="FIXED">Rupees off</option>
            <option value="FREE_SHIPPING">Free delivery</option>
          </select>
        </F>
        <F label="Amount" hint="% or Rs; ignored for free delivery">
          <input name="value" inputMode="numeric" defaultValue={c?.value ?? ""} className="field tag-text" />
        </F>
        <F label="Minimum order (Rs)">
          <input name="minSubtotal" inputMode="numeric" defaultValue={c?.minSubtotal ?? 0} className="field tag-text" />
        </F>
        <F label="Max uses" hint="Empty = unlimited">
          <input name="maxUses" inputMode="numeric" defaultValue={c?.maxUses ?? ""} className="field tag-text" />
        </F>
        <label className="flex min-h-11 items-center gap-3 self-end text-sm">
          <input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="size-5 accent-ink" /> Active
        </label>
        <F label="Starts (PKT, optional)">
          <input name="startsAt" type="datetime-local" defaultValue={c?.startsAt ? toPakistanLocal(c.startsAt) : ""} className="field tag-text" />
        </F>
        <F label="Ends (PKT, optional)">
          <input name="endsAt" type="datetime-local" defaultValue={c?.endsAt ? toPakistanLocal(c.endsAt) : ""} className="field tag-text" />
        </F>
      </div>
    </>
  );
}

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await db.coupon.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date();
  return (
    <>
      <PageHeader title="Coupons" subtitle="Codes customers type at checkout. Each use is claimed when the order is placed and given back if it's cancelled." />
      <div className="flex flex-col gap-3">
        {coupons.map((c) => (
          <details key={c.id} className="border-2 border-ink bg-card">
            <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3">
              <span className="tag-text font-bold">{c.code}</span>
              <span className="text-sm">{describe(c)}</span>
              <span className="tag-text text-xs text-muted">
                used {c.usedCount}
                {c.maxUses !== null ? `/${c.maxUses}` : ""}
              </span>
              <span className={`chip ${state(c, now) === "Active" ? "chip-solid" : "chip-muted"}`}>{state(c, now)}</span>
            </summary>
            <div className="flex flex-col gap-3 border-t-2 border-dashed border-ink p-3">
              <ActionForm action={saveCouponAction} submitLabel="Save code">
                <CouponFields c={c} />
              </ActionForm>
              <ActionForm action={deleteCouponAction} submitLabel="Delete code" submitClassName="btn btn-ghost btn-sm" confirm={`Delete ${c.code}?`}>
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </div>
          </details>
        ))}
        <Panel title="New code">
          <ActionForm action={saveCouponAction} submitLabel="Create code" resetOnSuccess>
            <CouponFields />
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
