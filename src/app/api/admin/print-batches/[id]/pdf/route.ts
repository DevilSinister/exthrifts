import { readFile } from "node:fs/promises";
import path from "node:path";
import { AuthError, assertAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderSlipsPdf } from "@/lib/pdf/slips";
import { displayPhone, normalizePkPhone } from "@/lib/phone";
import { getSettings } from "@/lib/settings";
import { formatOrderNumber, site } from "@/lib/site";

// Optional artwork: drop a black-on-transparent PNG here to print it on every slip.
const LOGO_PATH = path.join(process.cwd(), "public", "brand", "slip-logo.png");

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(LOGO_PATH));
  } catch {
    return null;
  }
}

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/print-batches/[id]/pdf">) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AuthError) return new Response(error.message, { status: error.status });
    throw error;
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Not found", { status: 404 });

  const batch = await db.printBatch.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "asc" },
        include: { items: { select: { title: true, size: true, price: true, quantity: true } } },
      },
    },
  });
  if (!batch) return new Response("Not found", { status: 404 });

  const [settings, logo] = await Promise.all([getSettings(), loadLogo()]);
  const storePhone = normalizePkPhone(settings.store.phone);
  const bytes = await renderSlipsPdf(
    batch.orders.map((o) => ({
      label: formatOrderNumber(o.number),
      createdAt: o.createdAt,
      customerName: o.customerName,
      phone: displayPhone(o.phone),
      address: o.address,
      city: o.city,
      notes: o.notes,
      items: o.items,
      subtotal: o.subtotal,
      shipping: o.shipping,
      discount: o.discount,
      total: o.total,
    })),
    {
      name: site.name,
      returnName: settings.store.returnName || site.name,
      returnAddress: settings.store.returnAddress,
      returnCity: settings.store.returnCity,
      phone: storePhone ? displayPhone(storePhone) : settings.store.phone,
    },
    logo,
  );

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${site.name.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}-slips-batch-${batch.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
