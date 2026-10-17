// Production-safe seed: creates the first owner (from env), the starter
// categories and the policy pages. Idempotent — it never overwrites anything
// that already exists, so it is safe to run again after every deploy.
//
//   npm run db:seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/lib/db";

const hashPasswordForSeed = (password: string) => bcrypt.hash(password, 12);

const db = createPrismaClient();

const CATEGORIES = [
  { name: "Jackets", slug: "jackets", sortOrder: 1 },
  { name: "Tees", slug: "tees", sortOrder: 2 },
  { name: "Hoodies & Sweaters", slug: "hoodies-sweaters", sortOrder: 3 },
  { name: "Jerseys", slug: "jerseys", sortOrder: 4 },
  { name: "Jeans", slug: "jeans", sortOrder: 5 },
  { name: "Caps", slug: "caps", sortOrder: 6 },
];

// Starter wording only: the owner edits these in Admin > Storefront > Pages
// before launch. Facts that only the owner knows are left as [brackets].
const PAGES = [
  {
    slug: "shipping",
    title: "Shipping",
    sortOrder: 1,
    body: `We deliver all over Pakistan with cash on delivery.

Delivery fee: shown at checkout before you place the order.
Delivery time: usually [3–5] working days after your order is confirmed.

Once your parcel is handed to the courier you'll get the tracking number from us.`,
  },
  {
    slug: "returns",
    title: "Returns & exchanges",
    sortOrder: 2,
    body: `Every piece is one of one, so please check the measurements and condition notes before ordering.

[Write your return policy here: whether you accept returns, within how many days, who pays the delivery, and how to contact you.]`,
  },
  {
    slug: "faq",
    title: "FAQ",
    sortOrder: 3,
    body: `Are the items new?
No. Everything is pre-owned vintage, checked and cleaned. Each listing shows a condition grade out of 10 and any flaws.

How do I know if it fits?
Every listing has measurements in inches, taken flat. Compare them with a piece you already own.

Does adding to cart hold the item?
No. A piece is yours only when you place the order. If someone else checks out first, it's gone.

How do I pay?
Cash on delivery. Pay the rider when your parcel arrives.`,
  },
  {
    slug: "about",
    title: "About",
    sortOrder: 4,
    body: `[Tell your story: who picks the pieces, where they come from, and what you look for.]`,
  },
  {
    slug: "privacy",
    title: "Privacy",
    sortOrder: 5,
    body: `We only collect what we need to deliver your order: your name, phone number, address, city and (optionally) email.

We share your delivery details with the courier and no one else. We don't sell your data.

To ask for your data to be deleted, contact us using the details on the Contact page.`,
  },
  {
    slug: "terms",
    title: "Terms",
    sortOrder: 6,
    body: `[Write your terms of sale here.]`,
  },
];

async function main() {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "";
  const owners = await db.adminUser.count({ where: { role: "OWNER" } });
  if (owners === 0) {
    if (!email || password.length < 10) {
      console.warn("No owner exists. Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD (10+ chars) and run again.");
    } else {
      await db.adminUser.create({
        data: { email, name: "Owner", role: "OWNER", passwordHash: await hashPasswordForSeed(password) },
      });
      console.log(`Created owner ${email}.`);
    }
  }

  for (const category of CATEGORIES) {
    await db.category.upsert({ where: { slug: category.slug }, create: category, update: {} });
  }
  for (const page of PAGES) {
    await db.page.upsert({ where: { slug: page.slug }, create: page, update: {} });
  }
  console.log(`Seeded ${CATEGORIES.length} categories and ${PAGES.length} pages (existing rows untouched).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
