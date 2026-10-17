import { z } from "zod";
import { AuthError, assertAdmin, sameOrigin } from "@/lib/auth";
import { OrderActionError, createPrintBatch } from "@/lib/orders/service";

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("new") }),
  z.object({ kind: z.literal("ids"), ids: z.array(z.string().min(1).max(40)).min(1).max(400) }),
]);

/** Creates a print batch and moves its New orders to Processing. The PDF is fetched separately. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  try {
    const admin = await assertAdmin();
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Nothing selected to print." }, { status: 400 });
    const result = await createPrintBatch(admin.id, parsed.data);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof OrderActionError) return Response.json({ error: error.message }, { status: 409 });
    console.error("[print] batch failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't create the slips. Try again." }, { status: 500 });
  }
}
