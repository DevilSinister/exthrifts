// Photos live on disk in UPLOAD_DIR, which must sit OUTSIDE the app folder on
// Hostinger so a redeploy from GitHub never wipes them. Each upload is
// auto-rotated from EXIF, stripped of metadata (no GPS from phone photos) and
// saved as three WebP widths.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_WIDTHS } from "@/lib/images/loader";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"]);

export function uploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), "uploads"));
}

/** Keys look like "p/2026/10/k3j9x2m1a8qz". */
const KEY_PATTERN = /^[a-z]+\/\d{4}\/\d{2}\/[a-z0-9]{12,32}$/;
const FILE_PATTERN = /^[a-z]+\/\d{4}\/\d{2}\/[a-z0-9]{12,32}-(400|800|1600)\.webp$/;

export function isValidKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Resolves a public /media path to a file inside UPLOAD_DIR, or null if it's not one of ours. */
export function resolveMediaFile(relative: string): string | null {
  if (!FILE_PATTERN.test(relative)) return null;
  const root = uploadRoot();
  const full = path.resolve(root, relative);
  return full.startsWith(root + path.sep) ? full : null;
}

export class UploadError extends Error {}

export interface StoredImage {
  key: string;
  width: number;
  height: number;
}

export async function storeImage(buffer: Buffer, mimeType: string, folder = "p"): Promise<StoredImage> {
  if (!ALLOWED_TYPES.has(mimeType)) throw new UploadError("Upload a JPG, PNG, WebP or HEIC photo.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("Photos must be under 15 MB.");

  const { default: sharp } = await import("sharp");
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(9)
    .toString("base64url")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .padEnd(12, "0")}`;
  const dir = path.join(uploadRoot(), path.dirname(key));
  await mkdir(dir, { recursive: true });

  let source: import("sharp").Sharp;
  let meta: import("sharp").Metadata;
  try {
    source = sharp(buffer, { failOn: "error" }).rotate();
    meta = await source.metadata();
  } catch {
    throw new UploadError("That file isn't a readable image.");
  }
  // After .rotate(), EXIF orientations 5–8 swap width and height.
  const swap = (meta.orientation ?? 1) >= 5;
  const width = (swap ? meta.height : meta.width) ?? 0;
  const height = (swap ? meta.width : meta.height) ?? 0;
  if (!width || !height) throw new UploadError("That file isn't a readable image.");

  for (const target of IMAGE_WIDTHS) {
    const out = await source
      .clone()
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: target === 400 ? 72 : 80 })
      .toBuffer();
    await writeFile(path.join(uploadRoot(), `${key}-${target}.webp`), out);
  }
  return { key, width, height };
}

export async function deleteImage(key: string): Promise<void> {
  if (!isValidKey(key)) return;
  await Promise.all(
    IMAGE_WIDTHS.map((w) => rm(path.join(uploadRoot(), `${key}-${w}.webp`), { force: true })),
  );
}

export async function readMediaFile(relative: string): Promise<{ data: Buffer; size: number; mtime: Date } | null> {
  const file = resolveMediaFile(relative);
  if (!file) return null;
  try {
    const info = await stat(file);
    return { data: await readFile(file), size: info.size, mtime: info.mtime };
  } catch {
    return null;
  }
}
