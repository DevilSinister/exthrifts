// LOCAL DEMO DATA ONLY. Fills a throwaway database with sample products,
// a scheduled drop, sold pieces and a coupon so every screen can be checked.
// Refuses to run against anything that isn't localhost.
//
//   npm run db:local   (in another terminal)
//   npm run db:deploy && npm run db:seed && npm run db:demo
import "dotenv/config";
import sharp from "sharp";
import { createPrismaClient } from "../src/lib/db";
import { storeImage } from "../src/lib/images/storage";

const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
  console.error(`Refusing to load demo data into ${url.hostname}. Demo data is for local databases only.`);
  process.exit(1);
}

const db = createPrismaClient();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const SAMPLES = [
  { title: "90s Harley-Davidson leather jacket", cat: "jackets", size: "L", price: 12500, compare: 15000, brand: "Harley-Davidson", era: "90s", m: { chest: 23, length: 27, shoulder: 19.5, sleeve: 25 } },
  { title: "Carhartt detroit work jacket", cat: "jackets", size: "XL", price: 8900, brand: "Carhartt", era: "00s", m: { chest: 25, length: 28 } },
  { title: "Slayer 1991 tour tee", cat: "tees", size: "M", price: 4500, brand: "Brockum", era: "90s", m: { chest: 21, length: 28 } },
  { title: "Faded Nirvana smiley tee", cat: "tees", size: "L", price: 3200, era: "00s", m: { chest: 22, length: 29 } },
  { title: "Single-stitch blank tee, washed black", cat: "tees", size: "M", price: 1650, compare: 2200, era: "90s", m: { chest: 20.5, length: 27.5 } },
  { title: "Champion reverse weave hoodie", cat: "hoodies-sweaters", size: "L", price: 5200, brand: "Champion", era: "90s", m: { chest: 24, length: 27 } },
  { title: "Ralph Lauren cable-knit sweater", cat: "hoodies-sweaters", size: "M", price: 4800, brand: "Ralph Lauren", era: "90s", m: { chest: 22.5, length: 26 } },
  { title: "Adidas 1998 Germany away jersey", cat: "jerseys", size: "XL", price: 6500, brand: "Adidas", era: "90s", m: { chest: 24, length: 30 } },
  { title: "Juventus 2002 home shirt", cat: "jerseys", size: "M", price: 5900, brand: "Lotto", era: "00s", m: { chest: 21, length: 29 } },
  { title: "Levi's 501 baggy, light wash", cat: "jeans", size: "32x30", price: 4200, brand: "Levi's", era: "90s", m: { waist: 32, inseam: 30 } },
  { title: "Wrangler carpenter jeans", cat: "jeans", size: "34x32", price: 3900, brand: "Wrangler", era: "00s", m: { waist: 34, inseam: 32 } },
  { title: "Nike swoosh dad cap", cat: "caps", size: "One size", price: 1800, brand: "Nike", era: "00s", m: {} },
];

async function placeholder(label: string, shade: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">
    <rect width="100%" height="100%" fill="rgb(${shade},${shade},${shade})"/>
    <rect x="60" y="60" width="780" height="1080" fill="none" stroke="#111" stroke-width="6" stroke-dasharray="18 12"/>
    <text x="450" y="560" font-family="Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle" fill="#111">SAMPLE</text>
    <text x="450" y="640" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="#111">${label.replace(/[<&>]/g, "")}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

const slugify = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const now = new Date();
  const categories = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));
  if (!Object.keys(categories).length) throw new Error("Run `npm run db:seed` first.");

  const created: string[] = [];
  for (const [i, s] of SAMPLES.entries()) {
    const slug = slugify(s.title);
    if (await db.product.findUnique({ where: { slug } })) continue;
    const images = [];
    for (const [j, view] of ["front", "back", "tag"].entries()) {
      const stored = await storeImage(await placeholder(`${s.title.slice(0, 28)} · ${view}`, 225 - j * 18), "image/jpeg");
      images.push({ ...stored, alt: `${s.title}, ${view}`, sortOrder: j });
    }
    const product = await db.product.create({
      data: {
        slug,
        title: s.title,
        description: "Sample listing for local testing. Real listings describe fit, fabric and any flaws.",
        status: "PUBLISHED",
        price: s.price,
        compareAtPrice: s.compare ?? null,
        stock: 1,
        size: s.size,
        measurements: s.m,
        conditionGrade: 8 + (i % 3),
        conditionNotes: i % 4 === 0 ? "Light fading on the collar." : null,
        brand: s.brand ?? null,
        era: s.era,
        categoryId: categories[s.cat],
        publishedAt: new Date(now.getTime() - (SAMPLES.length - i) * HOUR),
        images: { create: images },
      },
    });
    created.push(product.id);
  }

  if (created.length >= 4) {
    // Two pieces sold recently (listed with SOLD), one sold long ago (archived).
    await db.product.update({ where: { id: created[2] }, data: { stock: 0, soldAt: new Date(now.getTime() - 2 * DAY) } });
    await db.product.update({ where: { id: created[6] }, data: { stock: 0, soldAt: new Date(now.getTime() - 5 * DAY) } });
    await db.product.update({ where: { id: created[11] }, data: { stock: 0, soldAt: new Date(now.getTime() - 10 * DAY) } });

    const grails = await db.collection.upsert({
      where: { slug: "rarest-grails" },
      create: { name: "Rarest grails", slug: "rarest-grails", showOnHome: true, sortOrder: 1 },
      update: {},
    });
    await db.collection.update({
      where: { id: grails.id },
      data: { products: { connect: [created[0], created[7], created[2]].map((id) => ({ id })) } },
    });
  }

  // A drop two hours out with three draft pieces.
  if (!(await db.drop.findUnique({ where: { slug: "friday-night-drop" } }))) {
    const startsAt = new Date(now.getTime() + 2 * HOUR);
    const drop = await db.drop.create({
      data: {
        name: "Friday night drop",
        slug: "friday-night-drop",
        description: "Twelve leather jackets and band tees, one of each. Live at 9pm.",
        startsAt,
        showPreview: true,
        announce: true,
      },
    });
    for (const [i, title] of ["Vintage suede trucker jacket", "Metallica 1994 tee", "Varsity wool bomber"].entries()) {
      const stored = await storeImage(await placeholder(`${title} · front`, 200 - i * 15), "image/jpeg");
      await db.product.create({
        data: {
          slug: slugify(title),
          title,
          status: "PUBLISHED",
          price: 5500 + i * 1500,
          stock: 1,
          size: ["M", "L", "XL"][i],
          measurements: { chest: 22 + i, length: 27 + i },
          conditionGrade: 9,
          era: "90s",
          categoryId: categories[i === 1 ? "tees" : "jackets"],
          dropId: drop.id,
          publishedAt: startsAt,
          images: { create: [{ ...stored, alt: `${title}, front`, sortOrder: 0 }] },
        },
      });
    }
  }

  await db.coupon.upsert({
    where: { code: "WELCOME10" },
    create: { code: "WELCOME10", type: "PERCENT", value: 10, minSubtotal: 2000 },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "store" },
    create: {
      key: "store",
      value: {
        phone: "0300 0000000",
        whatsapp: "03000000000",
        email: "hello@example.test",
        returnName: "ExThrifts",
        returnAddress: "Shop 4, Main Market, Gulberg III",
        returnCity: "Lahore",
        instagram: "",
        tiktok: "",
        facebook: "",
      },
    },
    update: {},
  });
  await db.setting.upsert({
    where: { key: "shipping" },
    create: { key: "shipping", value: { flatRate: 250, freeOver: 8000, deliveryText: "Delivered in 3–5 working days across Pakistan.", returnsText: "Each piece is one of one. Check the measurements before ordering." } },
    update: {},
  });

  console.log(`Demo data ready: ${created.length} new products, 1 drop, coupon WELCOME10.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
