// Rasterise the brand SVGs with sharp (librsvg). Run after build-brand.py.
//
//   node brand/export-png.mjs                  -> every PNG in png-src/manifest.json
//   node brand/export-png.mjs --preview <dir>  -> inspection renders (large, small, print size)
//
// sharp resolves from the repository root's node_modules.
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

async function render(svgPath, vbWidth, width, height, background) {
  const svg = await readFile(svgPath);
  // Render at the target resolution directly rather than scaling a bitmap.
  const density = Math.min(100000, (72 * width) / vbWidth);
  let img = sharp(svg, { density }).resize(width, height, { fit: "contain", background: transparent });
  if (background) img = img.flatten({ background });
  return img;
}

async function exportAll() {
  const jobs = JSON.parse(await readFile(path.join(here, "png-src", "manifest.json"), "utf8"));
  for (const job of jobs) {
    const out = path.join(here, job.out);
    await mkdir(path.dirname(out), { recursive: true });
    const img = await render(path.join(here, job.src), job.viewBoxWidth, job.width, job.height, job.background);
    await img.png({ compressionLevel: 9 }).toFile(out);
    console.log(`${job.out}  ${job.width}x${job.height}`);
  }
}

function viewBox(svgText) {
  const [, , w, h] = svgText.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return { w, h };
}

// Render at a small pixel size, then blow it up with nearest-neighbour so the real pixels can be inspected.
async function smallBlownUp(svgPath, vb, height, background, zoom, out) {
  const width = Math.round((height * vb.w) / vb.h);
  const small = await (await render(svgPath, vb.w, width, height, background)).png().toBuffer();
  await sharp(small).resize(width * zoom, height * zoom, { kernel: "nearest" }).png().toFile(out);
}

async function preview(dir) {
  await mkdir(dir, { recursive: true });
  const names = (await readdir(here)).filter((f) => f.endsWith(".svg"));
  for (const name of names) {
    const file = path.join(here, name);
    const vb = viewBox(await readFile(file, "utf8"));
    const bg = name.includes("-white") ? "#000000" : "#ffffff";
    const base = path.join(dir, name.replace(".svg", ""));
    const largeW = 900;
    await (await render(file, vb.w, largeW, Math.round((largeW * vb.h) / vb.w), bg)).png().toFile(`${base}-large.png`);
    if (name.startsWith("tag")) {
      await smallBlownUp(file, vb, 32, bg, 6, `${base}-32px-x6.png`);
      await smallBlownUp(file, vb, 24, bg, 6, `${base}-24px-x6.png`);
    }
    if (name.startsWith("favicon") || name.startsWith("monogram")) {
      await smallBlownUp(file, vb, 16, bg, 12, `${base}-16px-x12.png`);
      await smallBlownUp(file, vb, 32, bg, 8, `${base}-32px-x8.png`);
    }
    if (name.startsWith("stamp")) {
      // 25 mm wide at 300 dpi = 295 px: the smallest print use (parcel slip).
      await (await render(file, vb.w, 295, 295, bg)).png().toFile(`${base}-25mm-300dpi.png`);
      await smallBlownUp(file, vb, 96, bg, 4, `${base}-96px-x4.png`);
    }
  }
  // Android foreground composited on its black background with the launcher's circle mask.
  const fg = await readFile(path.join(here, "android", "ic_launcher_foreground.png")).catch(() => null);
  if (fg) {
    const mask = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432"><circle cx="216" cy="216" r="144" fill="#fff"/></svg>',
    );
    const safe = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432"><circle cx="216" cy="216" r="132" fill="none" stroke="#888" stroke-width="2" stroke-dasharray="6 6"/></svg>',
    );
    await sharp({ create: { width: 432, height: 432, channels: 4, background: "#000000" } })
      .composite([{ input: fg }, { input: safe }, { input: mask, blend: "dest-in" }])
      .png()
      .toFile(path.join(dir, "android-adaptive-circle.png"));
  }
  console.log(`previews written to ${dir}`);
}

const i = process.argv.indexOf("--preview");
if (i !== -1) await preview(process.argv[i + 1] ?? path.join((await import("node:os")).tmpdir(), "exthrifts-brand-preview"));
else await exportAll();
