"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { fd, run, UserError, type ActionState } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { addOrderNote, bulkChangeStatus, changeStatus } from "@/lib/orders/service";
import { STATUS_LABEL, isOrderStatus } from "@/lib/orders/transitions";

export async function changeStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const orderId = fd.str(form, "orderId");
    const to = fd.str(form, "to");
    if (!isOrderStatus(to)) throw new UserError("Choose a status.");
    await changeStatus(orderId, {
      to,
      actorId: admin.id,
      courier: fd.opt(form, "courier"),
      trackingNo: fd.opt(form, "trackingNo"),
      message: fd.opt(form, "message"),
    });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    return `Marked as ${STATUS_LABEL[to]}.`;
  });
}

export async function bulkStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const ids = fd.list(form, "ids");
    const to = fd.str(form, "to");
    if (!ids.length) throw new UserError("Tick at least one order.");
    if (!isOrderStatus(to)) throw new UserError("Choose a status.");
    const results = await bulkChangeStatus(ids, { to, actorId: admin.id, courier: fd.opt(form, "courier") });
    revalidatePath("/admin/orders");
    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) throw new UserError(failed[0]?.error ?? "Nothing changed.");
    return failed.length
      ? `${results.length - failed.length} updated, ${failed.length} skipped (${failed[0].error})`
      : `${results.length} order${results.length === 1 ? "" : "s"} marked ${STATUS_LABEL[to]}.`;
  });
}

export async function addNoteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const orderId = fd.str(form, "orderId");
    await addOrderNote(orderId, admin.id, fd.str(form, "note"));
    revalidatePath(`/admin/orders/${orderId}`);
    return "Note added.";
  });
}

export async function updateDeliveryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const orderId = fd.str(form, "orderId");
    const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (!order) throw new UserError("Order not found.");
    if (order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "RETURNED") {
      throw new UserError("This order is closed; its address can't change.");
    }
    const customerName = fd.str(form, "customerName");
    const city = fd.str(form, "city");
    const address = fd.str(form, "address");
    if (customerName.length < 2 || city.length < 2 || address.length < 5) throw new UserError("Name, city and address are required.");
    await db.order.update({
      where: { id: orderId },
      data: { customerName, city, address, courier: fd.opt(form, "courier"), trackingNo: fd.opt(form, "trackingNo") },
    });
    await db.orderEvent.create({ data: { orderId, type: "note", message: "Delivery details edited.", actorId: admin.id } });
    revalidatePath(`/admin/orders/${orderId}`);
    return "Delivery details saved.";
  });
}
