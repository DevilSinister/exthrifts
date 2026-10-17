// Serves uploaded photos from UPLOAD_DIR. Only our own generated WebP file
// names are accepted, and the resolved path must stay inside the upload root.
import { readMediaFile } from "@/lib/images/storage";

export async function GET(_request: Request, ctx: RouteContext<"/media/[...path]">) {
  const { path } = await ctx.params;
  const file = await readMediaFile(path.join("/"));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.size),
      // Keys are random and never reused, so files can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Last-Modified": file.mtime.toUTCString(),
    },
  });
}
