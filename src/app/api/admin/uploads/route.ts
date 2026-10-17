import { AuthError, assertAdmin, sameOrigin } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, UploadError, storeImage } from "@/lib/images/storage";

/** One photo per request (multipart field "file"); returns the stored key and size. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin" }, { status: 403 });
  try {
    await assertAdmin();
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 64_000) return Response.json({ error: "Photos must be under 15 MB." }, { status: 413 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No photo received." }, { status: 400 });
    const folder = form.get("folder") === "site" ? "s" : "p";
    const stored = await storeImage(Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream", folder);
    return Response.json(stored);
  } catch (error) {
    if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: 400 });
    console.error("[upload] failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
