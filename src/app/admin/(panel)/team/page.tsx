import { addMemberAction, resetPasswordAction, updateMemberAction } from "@/app/admin/actions/team";
import { ActionForm, F } from "@/components/admin/ActionForm";
import { PageHeader, Panel, pkDateTime } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const admin = await requireAdmin("OWNER");
  const members = await db.adminUser.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });

  return (
    <>
      <PageHeader title="Team" subtitle="Owners can change settings and the team. Staff handle orders, pieces and drops." />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <ul className="flex flex-col gap-3">
          {members.map((m) => (
            <li key={m.id} className="border-2 border-ink bg-card">
              <details>
                <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {m.name} {m.id === admin.id && <span className="text-muted">(you)</span>}
                    </span>
                    <span className="tag-text text-xs text-muted">{m.email}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`chip ${m.role === "OWNER" ? "chip-solid" : ""}`}>{m.role.toLowerCase()}</span>
                    {!m.isActive && <span className="chip chip-muted">no access</span>}
                  </span>
                </summary>
                <div className="flex flex-col gap-4 border-t-2 border-dashed border-ink p-3">
                  <p className="tag-text text-xs text-muted">Last sign-in: {m.lastLoginAt ? pkDateTime.format(m.lastLoginAt) : "never"}</p>
                  {m.id !== admin.id && (
                    <ActionForm action={updateMemberAction} submitLabel="Save access">
                      <input type="hidden" name="id" value={m.id} />
                      <F label="Role">
                        <select name="role" defaultValue={m.role} className="field">
                          <option value="STAFF">Staff</option>
                          <option value="OWNER">Owner</option>
                        </select>
                      </F>
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input type="checkbox" name="isActive" defaultChecked={m.isActive} className="size-5 accent-ink" /> Can sign in
                      </label>
                    </ActionForm>
                  )}
                  <ActionForm action={resetPasswordAction} submitLabel={m.id === admin.id ? "Change my password" : "Reset password"} submitClassName="btn btn-line" resetOnSuccess>
                    <input type="hidden" name="id" value={m.id} />
                    <F label="New password" hint="At least 10 characters. Tell them in person, not by text.">
                      <input name="password" type="password" autoComplete="new-password" className="field" />
                    </F>
                  </ActionForm>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <Panel title="Add someone">
          <ActionForm action={addMemberAction} submitLabel="Add to team" resetOnSuccess>
            <F label="Name">
              <input name="name" required className="field" />
            </F>
            <F label="Email">
              <input name="email" type="email" required autoComplete="off" className="field" />
            </F>
            <F label="Starting password" hint="At least 10 characters.">
              <input name="password" type="password" required autoComplete="new-password" className="field" />
            </F>
            <F label="Role">
              <select name="role" defaultValue="STAFF" className="field">
                <option value="STAFF">Staff</option>
                <option value="OWNER">Owner</option>
              </select>
            </F>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
