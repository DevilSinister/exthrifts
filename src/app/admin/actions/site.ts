"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { fd, run, slugify, UserError, type ActionState } from "@/lib/admin-action";
import { db } from "@/lib/db";
import { isValidKey } from "@/lib/images/storage";
import { normalizePkPhone } from "@/lib/phone";
import { saveSettingGroup } from "@/lib/settings";

function refreshSite() {
  revalidatePath("/", "layout");
}

const url = (value: string | null) => {
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) throw new UserError(`Links must start with https:// (${value.slice(0, 40)})`);
  return value;
};

export async function saveStoreAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin("OWNER");
    const whatsapp = fd.str(form, "whatsapp");
    const phone = fd.str(form, "phone");
    if (whatsapp && !normalizePkPhone(whatsapp)) throw new UserError("WhatsApp must be a Pakistani mobile number, e.g. 0300 1234567.");
    if (phone && !normalizePkPhone(phone)) throw new UserError("Phone must be a Pakistani mobile number, e.g. 0300 1234567.");
    await saveSettingGroup("store", {
      phone,
      whatsapp,
      email: fd.str(form, "email"),
      returnName: fd.str(form, "returnName"),
      returnAddress: fd.str(form, "returnAddress"),
      returnCity: fd.str(form, "returnCity"),
      instagram: url(fd.opt(form, "instagram")),
      tiktok: url(fd.opt(form, "tiktok")),
      facebook: url(fd.opt(form, "facebook")),
    });
    await db.activityLog.create({ data: { actorId: admin.id, action: "settings.store", entity: "setting" } });
    refreshSite();
    return "Store details saved.";
  });
}

export async function saveShippingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin("OWNER");
    await saveSettingGroup("shipping", {
      flatRate: fd.int(form, "flatRate") ?? 0,
      freeOver: fd.int(form, "freeOver"),
      deliveryText: fd.str(form, "deliveryText"),
      returnsText: fd.str(form, "returnsText"),
    });
    await db.activityLog.create({ data: { actorId: admin.id, action: "settings.shipping", entity: "setting" } });
    refreshSite();
    return "Delivery settings saved. Checkout uses them right away.";
  });
}

export async function saveAnnouncementAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await assertAdmin();
    await saveSettingGroup("announcement", { enabled: fd.bool(form, "enabled"), text: fd.str(form, "text") });
    refreshSite();
    return "Top bar saved.";
  });
}

export async function saveHeroAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await assertAdmin();
    const href = fd.str(form, "ctaHref") || "/shop";
    if (!href.startsWith("/") && !/^https:\/\//.test(href)) throw new UserError("The button link must start with / or https://");
    const image = fd.opt(form, "imageKey");
    await saveSettingGroup("hero", {
      eyebrow: fd.str(form, "eyebrow"),
      title: fd.str(form, "title"),
      subtitle: fd.str(form, "subtitle"),
      ctaLabel: fd.str(form, "ctaLabel") || "Shop now",
      ctaHref: href,
      imageKey: image && isValidKey(image) ? image : null,
    });
    refreshSite();
    return "Home page hero saved.";
  });
}

/** One review per line: Name | City | What they said. */
export async function saveReviewsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    await assertAdmin();
    const reviews = fd
      .str(form, "reviews")
      .split(/\r?\n/)
      .map((line) => line.split("|").map((s) => s.trim()))
      .filter((parts) => parts.length >= 3 && parts[0] && parts[2])
      .map(([name, city, ...text]) => ({ name, city, text: text.join(" | ") }));
    if (reviews.length > 6) throw new UserError("Up to 6 reviews.");
    await saveSettingGroup("proof", { reviews });
    refreshSite();
    return reviews.length ? `${reviews.length} review(s) shown on the home page.` : "Reviews section hidden.";
  });
}

export async function savePageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const admin = await assertAdmin();
    const id = fd.opt(form, "id");
    const title = fd.str(form, "title");
    const body = fd.str(form, "body");
    if (title.length < 2) throw new UserError("Give the page a title.");
    const data = {
      title,
      body,
      slug: slugify(fd.str(form, "slug") || title),
      isPublished: fd.bool(form, "isPublished"),
      showInFooter: fd.bool(form, "showInFooter"),
      sortOrder: fd.int(form, "sortOrder") ?? 0,
    };
    const page = id ? await db.page.update({ where: { id }, data }) : await db.page.create({ data });
    await db.activityLog.create({ data: { actorId: admin.id, action: id ? "page.update" : "page.create", entity: "page", entityId: page.id, details: { title } } });
    refreshSite();
    return "Page saved.";
  });
}
