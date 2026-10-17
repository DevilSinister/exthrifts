// LOCAL DEMO DATA ONLY. Fills the local database with sample pieces, drops,
// coupons, a staff login and a month of orders in every status, so every
// screen (shop, drops, dashboard chart, orders, slips, customers) has data.
// Refuses to run against anything that isn't localhost. Safe to re-run:
// existing pieces, drops and coupons are left alone and orders are added once.
//
//   npm run db:local   (in another terminal)
//   npm run db:deploy && npm run db:seed && npm run db:demo
import "dotenv/config";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { createPrismaClient } from "../src/lib/db";
import { storeImage } from "../src/lib/images/storage";
import { placeOrder } from "../src/lib/orders/checkout";
import { changeStatus, createPrintBatch } from "../src/lib/orders/service";
import type { OrderStatusName } from "../src/lib/orders/transitions";

const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
  console.error(`Refusing to load demo data into ${url.hostname}. Demo data is for local databases only.`);
  process.exit(1);
}

const db = createPrismaClient();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Sample = {
  title: string;
  cat: string;
  size: string;
  price: number;
  compare?: number;
  brand?: string;
  era: string;
  m: Record<string, number>;
  stock?: number;
  status?: "DRAFT" | "PUBLISHED" | "HIDDEN";
  collections?: string[];
};

const SAMPLES: Sample[] = [
  // On the rack
  { title: "90s Harley-Davidson leather jacket", cat: "jackets", size: "L", price: 12500, compare: 15000, brand: "Harley-Davidson", era: "90s", m: { chest: 23, length: 27, shoulder: 19.5, sleeve: 25 }, collections: ["rarest-grails"] },
  { title: "Carhartt detroit work jacket", cat: "jackets", size: "XL", price: 8900, brand: "Carhartt", era: "00s", m: { chest: 25, length: 28 } },
  { title: "Slayer 1991 tour tee", cat: "tees", size: "M", price: 4500, brand: "Brockum", era: "90s", m: { chest: 21, length: 28 }, collections: ["rarest-grails"] },
  { title: "Faded Nirvana smiley tee", cat: "tees", size: "L", price: 3200, era: "00s", m: { chest: 22, length: 29 } },
  { title: "Single-stitch blank tee, washed black", cat: "tees", size: "M", price: 1650, compare: 2200, era: "90s", m: { chest: 20.5, length: 27.5 }, stock: 3 },
  { title: "Champion reverse weave hoodie", cat: "hoodies-sweaters", size: "L", price: 5200, brand: "Champion", era: "90s", m: { chest: 24, length: 27 } },
  { title: "Ralph Lauren cable-knit sweater", cat: "hoodies-sweaters", size: "M", price: 4800, brand: "Ralph Lauren", era: "90s", m: { chest: 22.5, length: 26 } },
  { title: "Adidas 1998 Germany away jersey", cat: "jerseys", size: "XL", price: 6500, brand: "Adidas", era: "90s", m: { chest: 24, length: 30 }, collections: ["rarest-grails"] },
  { title: "Juventus 2002 home shirt", cat: "jerseys", size: "M", price: 5900, brand: "Lotto", era: "00s", m: { chest: 21, length: 29 } },
  { title: "Levi's 501 baggy, light wash", cat: "jeans", size: "32x30", price: 4200, brand: "Levi's", era: "90s", m: { waist: 32, inseam: 30 } },
  { title: "Wrangler carpenter jeans", cat: "jeans", size: "34x32", price: 3900, brand: "Wrangler", era: "00s", m: { waist: 34, inseam: 32 } },
  { title: "Nike swoosh dad cap", cat: "caps", size: "One size", price: 1800, brand: "Nike", era: "00s", m: {} },
  { title: "Varsity wool letterman jacket", cat: "jackets", size: "M", price: 9800, era: "80s", m: { chest: 22, length: 26, sleeve: 24 } },
  { title: "Iron Maiden Somewhere in Time tee", cat: "tees", size: "XL", price: 6900, compare: 8500, era: "80s", m: { chest: 23.5, length: 30 }, collections: ["rarest-grails"] },
  { title: "Tommy Hilfiger colour-block windbreaker", cat: "jackets", size: "L", price: 4600, brand: "Tommy Hilfiger", era: "90s", m: { chest: 25, length: 27 } },
  { title: "Nautica quarter-zip fleece", cat: "hoodies-sweaters", size: "XL", price: 3600, brand: "Nautica", era: "00s", m: { chest: 25, length: 28 } },
  { title: "AC Milan 1996 Opel home shirt", cat: "jerseys", size: "L", price: 8200, brand: "Lotto", era: "90s", m: { chest: 22.5, length: 30 } },
  { title: "Dickies 874 work pants", cat: "jeans", size: "33x30", price: 2900, brand: "Dickies", era: "00s", m: { waist: 33, inseam: 30 } },
  { title: "New York Yankees snapback", cat: "caps", size: "One size", price: 1500, brand: "New Era", era: "00s", m: {} },
  { title: "Stussy 8-ball tee", cat: "tees", size: "L", price: 3800, brand: "Stussy", era: "00s", m: { chest: 22, length: 28.5 } },
  // Bought by the demo orders below
  { title: "Denim trucker jacket, stonewash", cat: "jackets", size: "M", price: 5400, brand: "Levi's", era: "90s", m: { chest: 22, length: 24 } },
  { title: "Metallica Black Album tee", cat: "tees", size: "L", price: 4200, era: "90s", m: { chest: 22, length: 29 } },
  { title: "Kappa track jacket", cat: "jackets", size: "M", price: 3900, brand: "Kappa", era: "00s", m: { chest: 21.5, length: 26 } },
  { title: "Fila logo crewneck", cat: "hoodies-sweaters", size: "L", price: 3300, brand: "Fila", era: "90s", m: { chest: 23, length: 26.5 } },
  { title: "Brazil 2002 home jersey", cat: "jerseys", size: "M", price: 7400, brand: "Nike", era: "00s", m: { chest: 21, length: 28 } },
  { title: "Lee rider jeans", cat: "jeans", size: "30x30", price: 2800, brand: "Lee", era: "90s", m: { waist: 30, inseam: 30 } },
  { title: "Polo bear cap", cat: "caps", size: "One size", price: 2400, brand: "Ralph Lauren", era: "90s", m: {} },
  { title: "Guns N' Roses Use Your Illusion tee", cat: "tees", size: "XL", price: 5600, era: "90s", m: { chest: 24, length: 30 } },
  { title: "Columbia fleece jacket", cat: "jackets", size: "L", price: 4100, brand: "Columbia", era: "00s", m: { chest: 24, length: 27 } },
  { title: "Puma king jersey", cat: "jerseys", size: "L", price: 3500, brand: "Puma", era: "00s", m: { chest: 22, length: 29 } },
  { title: "Gap heavy hoodie, navy", cat: "hoodies-sweaters", size: "M", price: 2700, brand: "Gap", era: "00s", m: { chest: 22, length: 26 } },
  { title: "Levi's 550 relaxed jeans", cat: "jeans", size: "34x30", price: 3700, brand: "Levi's", era: "90s", m: { waist: 34, inseam: 30 } },
  { title: "Bulls 1997 champions tee", cat: "tees", size: "L", price: 4900, brand: "Starter", era: "90s", m: { chest: 22.5, length: 29 } },
  { title: "Barbour waxed jacket", cat: "jackets", size: "L", price: 11500, brand: "Barbour", era: "90s", m: { chest: 24, length: 30 } },
  // Drafts, for the drop picker
  { title: "Pink Floyd prism tee (draft)", cat: "tees", size: "M", price: 3900, era: "90s", m: { chest: 21, length: 28 }, status: "DRAFT" },
  { title: "North Face nuptse puffer (draft)", cat: "jackets", size: "L", price: 14500, brand: "The North Face", era: "90s", m: { chest: 25, length: 26 }, status: "DRAFT" },
  { title: "Real Madrid 2003 away shirt (draft)", cat: "jerseys", size: "M", price: 6200, brand: "Adidas", era: "00s", m: { chest: 21, length: 29 }, status: "DRAFT" },
  { title: "Corduroy trucker cap (draft)", cat: "caps", size: "One size", price: 1700, era: "00s", m: {}, status: "DRAFT" },
  // Hidden
  { title: "Damaged denim vest (hidden)", cat: "jackets", size: "M", price: 1200, era: "90s", m: { chest: 21, length: 22 }, status: "HIDDEN" },
];

async function placeholder(label: string, shade: number): Promise<Buffer> {
  const safe = label.replace(/[<&>"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1125">
    <rect width="100%" height="100%" fill="rgb(${shade},${shade},${shade})"/>
    <rect x="60" y="60" width="780" height="1005" fill="none" stroke="#111" stroke-width="6" stroke-dasharray="18 12"/>
    <text x="450" y="520" font-family="Arial, sans-serif" font-size="52" font-weight="700" text-anchor="middle" fill="#111">SAMPLE</text>
    <text x="450" y="600" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="#111">${safe}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/\((draft|hidden)\)/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function images(title: string, views: string[], base = 228) {
  const out = [];
  for (const [j, view] of views.entries()) {
    const stored = await storeImage(await placeholder(`${title.slice(0, 30)} · ${view}`, base - j * 16), "image/jpeg");
    out.push({ ...stored, alt: `${title.replace(/ \((draft|hidden)\)/, "")}, ${view}`, sortOrder: j });
  }
  return out;
}

async function ensureCollections() {
  for (const [i, c] of [
    { name: "Rarest grails", slug: "rarest-grails", showOnHome: true },
    { name: "Under Rs 3,000", slug: "under-3000", showOnHome: false },
  ].entries()) {
    await db.collection.upsert({ where: { slug: c.slug }, create: { ...c, sortOrder: i + 1 }, update: {} });
  }
}

async function ensureProducts(now: Date) {
  const categories = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));
  if (!Object.keys(categories).length) throw new Error("Run `npm run db:seed` first.");
  let created = 0;
  for (const [i, s] of SAMPLES.entries()) {
    const slug = slugify(s.title);
    if (await db.product.findUnique({ where: { slug } })) continue;
    const status = s.status ?? "PUBLISHED";
    const collections = [...(s.collections ?? []), ...(s.price < 3000 ? ["under-3000"] : [])];
    await db.product.create({
      data: {
        slug,
        title: s.title.replace(/ \((draft|hidden)\)/, ""),
        description: "Sample listing for local testing.\n\nReal listings describe fit, fabric and any flaws.",
        status,
        price: s.price,
        compareAtPrice: s.compare ?? null,
        costPrice: Math.round(s.price * 0.4),
        stock: s.stock ?? 1,
        size: s.size,
        measurements: s.m,
        conditionGrade: 7 + (i % 4),
        conditionNotes: i % 4 === 0 ? "Light fading on the collar." : i % 5 === 0 ? "Small mark on the back hem." : null,
        brand: s.brand ?? null,
        era: s.era,
        tags: [s.era, s.cat],
        categoryId: categories[s.cat],
        publishedAt: status === "PUBLISHED" ? new Date(now.getTime() - (SAMPLES.length - i) * 6 * HOUR) : null,
        images: { create: await images(s.title, i % 3 === 0 ? ["front", "back", "tag"] : ["front", "back"]) },
        collections: { connect: collections.map((slug) => ({ slug })) },
      },
    });
    created += 1;
  }
  return created;
}

async function ensureDrops(now: Date) {
  const categories = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));
  // Upcoming, announced in the top bar.
  if (!(await db.drop.findUnique({ where: { slug: "friday-night-drop" } }))) {
    const startsAt = new Date(now.getTime() + 2 * HOUR);
    const drop = await db.drop.create({
      data: { name: "Friday night drop", slug: "friday-night-drop", description: "Leather, band tees and one varsity bomber. One of each.", startsAt },
    });
    for (const [i, title] of ["Vintage suede trucker jacket", "Metallica 1994 tour tee", "Varsity wool bomber"].entries()) {
      await db.product.create({
        data: {
          slug: slugify(title),
          title,
          status: "PUBLISHED",
          price: 5500 + i * 1500,
          size: ["M", "L", "XL"][i],
          measurements: { chest: 22 + i, length: 27 + i },
          conditionGrade: 9,
          era: "90s",
          categoryId: categories[i === 1 ? "tees" : "jackets"],
          dropId: drop.id,
          publishedAt: startsAt,
          images: { create: await images(title, ["front", "back"], 205 - i * 10) },
        },
      });
    }
  }
  // Already launched last week, one piece sold.
  if (!(await db.drop.findUnique({ where: { slug: "jersey-weekend" } }))) {
    const startsAt = new Date(now.getTime() - 6 * DAY);
    const drop = await db.drop.create({
      data: { name: "Jersey weekend", slug: "jersey-weekend", description: "Classic kits from the 90s and 00s.", startsAt, announce: false },
    });
    for (const [i, title] of ["Arsenal 1994 bruised banana away", "Inter 1998 Pirelli home"].entries()) {
      await db.product.create({
        data: {
          slug: slugify(title),
          title,
          status: "PUBLISHED",
          price: 9500 + i * 700,
          size: ["L", "M"][i],
          measurements: { chest: 22 + i, length: 29 },
          conditionGrade: 8,
          brand: ["Nike", "Umbro"][i],
          era: "90s",
          categoryId: categories.jerseys,
          dropId: drop.id,
          publishedAt: startsAt,
          stock: i === 0 ? 0 : 1,
          soldAt: i === 0 ? new Date(startsAt.getTime() + 20 * 60_000) : null,
          images: { create: await images(title, ["front", "back"], 215) },
        },
      });
    }
  }
}

async function ensureCoupons(now: Date) {
  const coupons = [
    { code: "WELCOME10", type: "PERCENT" as const, value: 10, minSubtotal: 2000 },
    { code: "FLAT500", type: "FIXED" as const, value: 500, minSubtotal: 4000 },
    { code: "FREESHIP", type: "FREE_SHIPPING" as const, value: 0, minSubtotal: 0 },
    { code: "ONEUSE", type: "PERCENT" as const, value: 20, minSubtotal: 0, maxUses: 1 },
    { code: "OLDSALE", type: "PERCENT" as const, value: 30, minSubtotal: 0, endsAt: new Date(now.getTime() - 3 * DAY) },
  ];
  for (const c of coupons) await db.coupon.upsert({ where: { code: c.code }, create: c, update: {} });
}

async function ensureSettings() {
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
    create: {
      key: "shipping",
      value: { flatRate: 250, freeOver: 8000, deliveryText: "Delivered in 3–5 working days across Pakistan.", returnsText: "Each piece is one of one. Check the measurements before ordering." },
    },
    update: {},
  });
}

async function ensureStaff() {
  const email = process.env.SEED_STAFF_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_STAFF_PASSWORD ?? "";
  if (!email || password.length < 10) return "skipped (set SEED_STAFF_EMAIL / SEED_STAFF_PASSWORD)";
  if (await db.adminUser.findUnique({ where: { email } })) return "exists";
  await db.adminUser.create({ data: { email, name: "Staff Tester", role: "STAFF", passwordHash: await bcrypt.hash(password, 12) } });
  return "created";
}

/** A month of realistic orders. Synthetic customers; phone numbers are not real. */
const ORDER_PLAN: Array<{ who: string; phone: string; city: string; address: string; pieces: string[]; daysAgo: number; to: OrderStatusName[]; coupon?: string; notes?: string }> = [
  { who: "Ayesha Khan", phone: "03331110001", city: "Karachi", address: "House 21, Street 5, Block 13-D, Gulshan-e-Iqbal", pieces: ["denim-trucker-jacket-stonewash"], daysAgo: 27, to: ["PROCESSING", "SHIPPED", "DELIVERED"] },
  { who: "Hamza Ali", phone: "03211110002", city: "Lahore", address: "Flat 3B, Askari 11, Sector B, near the park", pieces: ["metallica-black-album-tee", "polo-bear-cap"], daysAgo: 24, to: ["PROCESSING", "SHIPPED", "DELIVERED"], coupon: "WELCOME10" },
  { who: "Zara Ahmed", phone: "03451110003", city: "Islamabad", address: "House 9, Street 22, F-7/2", pieces: ["kappa-track-jacket"], daysAgo: 21, to: ["CANCELLED"] },
  { who: "Usman Tariq", phone: "03001110004", city: "Rawalpindi", address: "House 112, Lane 4, Bahria Town Phase 7", pieces: ["fila-logo-crewneck"], daysAgo: 19, to: ["PROCESSING", "SHIPPED", "DELIVERED"] },
  { who: "Ayesha Khan", phone: "03331110001", city: "Karachi", address: "House 21, Street 5, Block 13-D, Gulshan-e-Iqbal", pieces: ["brazil-2002-home-jersey"], daysAgo: 16, to: ["PROCESSING", "SHIPPED", "DELIVERED"], notes: "Same address as last time" },
  { who: "Bilal Siddiqui", phone: "03121110005", city: "Faisalabad", address: "House 5, Street 2, Madina Town", pieces: ["lee-rider-jeans"], daysAgo: 13, to: ["PROCESSING", "SHIPPED", "RETURNED"] },
  { who: "Sana Malik", phone: "03011110006", city: "Multan", address: "House 77, Gulgasht Colony", pieces: ["guns-n-roses-use-your-illusion-tee", "columbia-fleece-jacket"], daysAgo: 10, to: ["PROCESSING", "SHIPPED", "DELIVERED"], coupon: "FLAT500" },
  { who: "Faraz Hussain", phone: "03091110007", city: "Peshawar", address: "House 14, University Town, near Arbab Road", pieces: ["puma-king-jersey"], daysAgo: 7, to: ["PROCESSING", "SHIPPED"] },
  { who: "Hira Butt", phone: "03221110008", city: "Gujranwala", address: "House 3, Satellite Town, Block C", pieces: ["gap-heavy-hoodie-navy"], daysAgo: 5, to: ["PROCESSING", "SHIPPED"] },
  { who: "Hamza Ali", phone: "03211110002", city: "Lahore", address: "Flat 3B, Askari 11, Sector B, near the park", pieces: ["levis-550-relaxed-jeans"], daysAgo: 3, to: ["PROCESSING"], coupon: "FREESHIP" },
  { who: "Ali Raza", phone: "03151110009", city: "Sialkot", address: "House 8, Cantt, Paris Road", pieces: ["bulls-1997-champions-tee"], daysAgo: 2, to: ["PROCESSING"] },
  { who: "Maryam Iqbal", phone: "03361110010", city: "Hyderabad", address: "Bungalow 19, Qasimabad Phase 1", pieces: ["barbour-waxed-jacket"], daysAgo: 1, to: [], notes: "Please call before delivery" },
  { who: "Daniyal Shah", phone: "03041110011", city: "Quetta", address: "House 40, Jinnah Town, Samungli Road", pieces: ["single-stitch-blank-tee-washed-black"], daysAgo: 0.4, to: [] },
  { who: "Iqra Javed", phone: "03471110012", city: "Abbottabad", address: "House 2, Jinnahabad, Street 6", pieces: ["stussy-8-ball-tee"], daysAgo: 0.1, to: [] },
];

async function ensureOrders(now: Date) {
  if (await db.setting.findUnique({ where: { key: "demo.orders" } })) return "already added";
  const owner = await db.adminUser.findFirst({ where: { role: "OWNER" } });
  if (!owner) return "skipped (no owner — run db:seed with SEED_OWNER_*)";
  let made = 0;
  for (const plan of ORDER_PLAN) {
    const products = await db.product.findMany({ where: { slug: { in: plan.pieces } }, select: { id: true } });
    if (products.length !== plan.pieces.length) continue;
    let order: { id: string; number: number };
    try {
      order = await placeOrder({
        items: products.map((p) => ({ productId: p.id, quantity: 1 })),
        customerName: plan.who,
        phone: plan.phone,
        city: plan.city,
        address: plan.address,
        notes: plan.notes,
        couponCode: plan.coupon,
      });
    } catch (error) {
      console.warn(`  skipped ${plan.who}: ${(error as Error).message}`);
      continue;
    }
    const placedAt = new Date(now.getTime() - plan.daysAgo * DAY);
    // Backdate so the dashboard chart and "sold this week" have history.
    await db.order.update({ where: { id: order.id }, data: { createdAt: placedAt } });
    await db.orderEvent.updateMany({ where: { orderId: order.id }, data: { createdAt: placedAt } });
    await db.product.updateMany({ where: { id: { in: products.map((p) => p.id) }, stock: 0 }, data: { soldAt: placedAt } });
    for (const [step, to] of plan.to.entries()) {
      if (to === "PROCESSING") {
        await createPrintBatch(owner.id, { kind: "ids", ids: [order.id] });
      } else {
        await changeStatus(order.id, { to, actorId: owner.id, courier: to === "SHIPPED" ? ["TCS", "Leopards", "PostEx"][made % 3] : undefined, trackingNo: to === "SHIPPED" ? `DEMO${100000 + made}` : undefined });
      }
      await db.orderEvent.updateMany({
        where: { orderId: order.id, createdAt: { gt: placedAt } },
        data: { createdAt: new Date(Math.min(placedAt.getTime() + (step + 1) * 20 * HOUR, now.getTime())) },
      });
    }
    made += 1;
  }
  await db.setting.create({ data: { key: "demo.orders", value: { addedAt: now.toISOString(), count: made } } });
  return `${made} added`;
}

async function main() {
  const now = new Date();
  await ensureCollections();
  const created = await ensureProducts(now);
  await ensureDrops(now);
  await ensureCoupons(now);
  await ensureSettings();
  const staff = await ensureStaff();
  const orders = await ensureOrders(now);
  const counts = await Promise.all([db.product.count(), db.order.count(), db.coupon.count(), db.drop.count()]);
  console.log(
    `Demo data ready: ${created} new pieces (${counts[0]} total), ${counts[3]} drops, ${counts[2]} coupons, ${counts[1]} orders (demo orders: ${orders}), staff login: ${staff}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    // The app's shared client (used by placeOrder) keeps a pool open; exit explicitly.
    process.exit(process.exitCode ?? 0);
  });
