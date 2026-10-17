import { resetPasswordAction } from "@/app/admin/actions/team";
import { saveShippingAction, saveStoreAction } from "@/app/admin/actions/site";
import { ActionForm, F } from "@/components/admin/ActionForm";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { site } from "@/lib/site";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const { store, shipping } = await getSettings();
  const owner = admin.role === "OWNER";

  return (
    <>
      <PageHeader title="Settings" subtitle={`${site.name} at ${site.url} — the name and domain are set in the server's environment variables.`} />
      {!owner && <Notice>Only an owner can change store and delivery settings.</Notice>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Store details & return address">
          <ActionForm action={saveStoreAction} submitLabel="Save details">
            <fieldset disabled={!owner} className="flex min-w-0 flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Phone (on slips)">
                  <input name="phone" defaultValue={store.phone} className="field tag-text" placeholder="0300 1234567" />
                </F>
                <F label="WhatsApp">
                  <input name="whatsapp" defaultValue={store.whatsapp} className="field tag-text" placeholder="0300 1234567" />
                </F>
              </div>
              <F label="Email">
                <input name="email" type="email" defaultValue={store.email} className="field" />
              </F>
              <F label="Return name" hint={`Printed on every slip. Empty = ${site.name}.`}>
                <input name="returnName" defaultValue={store.returnName} className="field" />
              </F>
              <F label="Return address">
                <input name="returnAddress" defaultValue={store.returnAddress} className="field" placeholder="Shop / house, street, area" />
              </F>
              <F label="Return city">
                <input name="returnCity" defaultValue={store.returnCity} className="field" />
              </F>
              <div className="grid gap-3 sm:grid-cols-3">
                <F label="Instagram link">
                  <input name="instagram" defaultValue={store.instagram} className="field" placeholder="https://instagram.com/…" />
                </F>
                <F label="TikTok link">
                  <input name="tiktok" defaultValue={store.tiktok} className="field" />
                </F>
                <F label="Facebook link">
                  <input name="facebook" defaultValue={store.facebook} className="field" />
                </F>
              </div>
            </fieldset>
          </ActionForm>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Delivery">
            <ActionForm action={saveShippingAction} submitLabel="Save delivery">
              <fieldset disabled={!owner} className="flex min-w-0 flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <F label="Delivery fee (Rs)">
                    <input name="flatRate" inputMode="numeric" defaultValue={shipping.flatRate} className="field tag-text" />
                  </F>
                  <F label="Free delivery from (Rs)" hint="Empty = never free">
                    <input name="freeOver" inputMode="numeric" defaultValue={shipping.freeOver ?? ""} className="field tag-text" />
                  </F>
                </div>
                <F label="Delivery time text">
                  <input name="deliveryText" defaultValue={shipping.deliveryText} maxLength={120} className="field" />
                </F>
                <F label="Returns summary (product pages)">
                  <input name="returnsText" defaultValue={shipping.returnsText} maxLength={200} className="field" />
                </F>
              </fieldset>
            </ActionForm>
          </Panel>

          <Panel title="Your password">
            <ActionForm action={resetPasswordAction} submitLabel="Change password" resetOnSuccess>
              <F label="New password" hint="At least 10 characters.">
                <input name="password" type="password" autoComplete="new-password" className="field" />
              </F>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
