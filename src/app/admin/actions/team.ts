"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin, hashPassword, passwordProblem } from "@/lib/auth";
import { fd, run, UserError, type ActionState } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { sendTestAlert } from "@/lib/push/outbox";

async function ownerCount(excludeId?: string) {
  return db.adminUser.count({ where: { role: "OWNER", isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export async function addMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin("OWNER");
    const email = fd.str(form, "email").toLowerCase();
    const name = fd.str(form, "name");
    const password = String(form.get("password") ?? "");
    const role = fd.str(form, "role") === "OWNER" ? "OWNER" : "STAFF";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new UserError("Enter a valid email.");
    if (name.length < 2) throw new UserError("Enter their name.");
    const problem = passwordProblem(password);
    if (problem) throw new UserError(problem);
    await db.adminUser.create({ data: { email, name, role, passwordHash: await hashPassword(password) } });
    await db.activityLog.create({ data: { actorId: admin.id, action: "team.add", entity: "adminUser", details: { email, role } } });
    revalidatePath("/admin/team");
    return `${name} can now sign in.`;
  });
}

export async function updateMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin("OWNER");
    const id = fd.str(form, "id");
    if (id === admin.id) throw new UserError("You can't change your own role or access. Ask another owner.");
    const member = await db.adminUser.findUnique({ where: { id } });
    if (!member) throw new UserError("Team member not found.");
    const role = fd.str(form, "role") === "OWNER" ? "OWNER" : "STAFF";
    const isActive = fd.bool(form, "isActive");
    if (member.role === "OWNER" && (role !== "OWNER" || !isActive) && (await ownerCount(id)) === 0) {
      throw new UserError("The store needs at least one active owner.");
    }
    await db.adminUser.update({ where: { id }, data: { role, isActive } });
    // Losing access or rights ends their sessions immediately.
    if (!isActive || (member.role === "OWNER" && role === "STAFF")) await db.session.deleteMany({ where: { userId: id } });
    await db.activityLog.create({ data: { actorId: admin.id, action: "team.update", entity: "adminUser", entityId: id, details: { role, isActive } } });
    revalidatePath("/admin/team");
    return "Saved.";
  });
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.str(form, "id") || admin.id;
    if (id !== admin.id && admin.role !== "OWNER") throw new UserError("Only an owner can reset someone else's password.");
    const password = String(form.get("password") ?? "");
    const problem = passwordProblem(password);
    if (problem) throw new UserError(problem);
    await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } });
    if (id !== admin.id) await db.session.deleteMany({ where: { userId: id } });
    await db.activityLog.create({ data: { actorId: admin.id, action: "team.password", entity: "adminUser", entityId: id } });
    return id === admin.id ? "Your password was changed." : "Password reset. They've been signed out everywhere.";
  });
}

export async function removeDeviceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.str(form, "id");
    const device = await db.adminDevice.findUnique({ where: { id }, select: { userId: true } });
    if (!device) throw new UserError("Already removed.");
    if (device.userId !== admin.id && admin.role !== "OWNER") throw new UserError("You can only remove your own phones.");
    await db.adminDevice.delete({ where: { id } });
    revalidatePath("/admin/devices");
    return "Phone removed. It won't get alerts until the app is opened and signed in again.";
  });
}

export async function testDeviceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await assertAdmin();
    const message = await sendTestAlert(fd.str(form, "id"));
    if (!message.startsWith("Test alert sent")) throw new UserError(message);
    revalidatePath("/admin/devices");
    return message;
  });
}
