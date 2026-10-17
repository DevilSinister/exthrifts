# ExThrifts

An online store for one-of-one vintage clothing in Pakistan, paid by cash on delivery. It includes:

- **Storefront.** A minimal shop with a scrolling top bar that counts down to the next drop, plus category racks, product pages with measurements and condition, the cart, checkout and order tracking.
- **Admin panel** at `/admin`. Built for phones. Covers orders, pieces, drops, inventory, categories and collections, coupons, customers, storefront and policy pages, settings, team, alert phones, print history and activity.
- **Parcel slips.** "Print new orders" downloads an A4 landscape PDF with four slips per page to cut and stick on parcels. Printed orders move from New to Processing.
- **Order-alert Android app** in `android/`. It pings on every new order, and tapping the alert opens that order. See `docs/ANDROID.md`.
- **Brand set** in `brand/`: a black-and-white vintage stamp logo, a tag lockup and icons.

Product rules are in `PRODUCT.md`, the audit of the reference site is in `docs/AUDIT.md`, and deployment is in `docs/DEPLOY-HOSTINGER.md`.

## How the shop behaves

- **Cart:** adding to the cart holds nothing. A piece is sold only when checkout completes. Each piece is claimed with a conditional update, so two buyers can never get the same one.
- **Sold pieces:** they stay listed with a SOLD stamp for 7 days, then leave listings and the sitemap. Their pages still open, with `noindex`.
- **Drops:** draft pieces go into a scheduled drop and become visible and buyable at its start time. This is computed from the clock, so no scheduler is needed.
- **Name and domain:** both come from `NEXT_PUBLIC_SITE_NAME` and `NEXT_PUBLIC_SITE_URL`.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind 4
- Prisma 7 with MySQL/MariaDB
- `sharp` for images
- `pdf-lib` for slips
- FCM HTTP v1 for alerts
- Vitest

## Local development

You need Node 22 or newer. Nothing else gets installed: the local database is a throwaway MySQL that `mysql-memory-server` downloads once and runs only while the command is open.

1. Copy the env template, then fill in `SESSION_SECRET` and the `SEED_OWNER_*` values:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. In terminal 1, start the database and leave it running:

   ```bash
   npm run db:local
   ```

4. In terminal 2, create the tables:

   ```bash
   npm run db:deploy
   ```

5. Seed the owner account, categories and policy pages:

   ```bash
   npm run db:seed
   ```

6. Optionally, load local-only sample pieces, a drop and a coupon:

   ```bash
   npm run db:demo
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

The shop runs at http://localhost:3400 and the admin at http://localhost:3400/admin.

## Checks

| Script | What it does |
|---|---|
| `npm run typecheck` | Types |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (pricing, transitions, visibility, drops, push rules, slips) |
| `NEXT_BUILD_DIR=.next-build npm run build` | Production build into a separate folder, so it never clashes with a running dev server |
