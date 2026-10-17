# Deploying to Hostinger

These steps target Hostinger's **Node.js Web App** hosting, which the owner's **Unlimited** plan lists. The app is a standard Next.js 16 server backed by a MySQL database.

> Before buying or deploying, confirm in hPanel that your plan shows **Websites → Add website → Node.js Web App**. Hostinger's support docs name the Business and Cloud plans. Its marketing page also lists Node.js under Unlimited.

## 1. Create the database

1. In hPanel, open **Databases → MySQL Databases** and create a database and a user. Write down the database name, user, password and host (often `localhost`).
2. Build the connection string:
   `mysql://USER:PASSWORD@HOST:3306/DATABASE`
   - URL-encode any special characters in the password, e.g. `@` becomes `%40`.

## 2. Create the uploads folder

Photos live on disk **outside** the app folder, so a redeploy never deletes them.

1. In **File Manager**, create a folder next to your site's folder, not inside it, e.g. `/home/<user>/exthrifts-uploads`.
2. Use that absolute path as `UPLOAD_DIR` below.
3. Back this folder up, together with the database. It is the only copy of your product photos.

## 3. Create the Node.js web app

1. Go to **Websites → Add website → Node.js Web App** and connect GitHub repository `DevilSinister/exthrifts`, branch `main`.
2. Set these values:
   - **Node version:** 22 or 24.
   - **Install:** `npm install`
   - **Build:** `npm run build:deploy`. This applies pending database migrations, then builds. If a migration fails, the build stops and the previous version keeps serving.
   - **Start:** `npm start`
3. Add these environment variables. `.env.example` describes each one.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_NAME` | `ExThrifts` |
| `NEXT_PUBLIC_SITE_URL` | `https://exthrifts.com`, no trailing slash |
| `NEXT_PUBLIC_ORDER_PREFIX` | `EXT` |
| `DATABASE_URL` | The connection string from step 1 |
| `SESSION_SECRET` | 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) |
| `UPLOAD_DIR` | The absolute folder from step 2 |
| `CRON_SECRET` | 16+ random characters |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | The service-account JSON on one line (see `docs/ANDROID.md`). Leave empty until the alert app is set up. |
| `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` | Your admin login, used once by the seed |

> `NEXT_PUBLIC_*` values are baked in at build time. Changing the name or domain needs a rebuild.

## 4. First deploy and seed

1. Deploy. The build creates all tables.
2. Run the seed once to create your owner account, the starter categories and the policy pages. It never overwrites existing data, so it is safe to repeat. Run it from the app's terminal or SSH, in the app folder:

```bash
npm run db:seed
```

3. Remove `SEED_OWNER_PASSWORD` from the environment afterwards, and change the password from **Admin → Settings**.

**Never** run `npm run db:demo` against production. It refuses any database host other than localhost.

## 5. Domain and HTTPS

1. Point `exthrifts.com` at the web app in hPanel.
2. Enable the free SSL certificate.
3. Check that `https://exthrifts.com/.well-known/assetlinks.json` loads. The Android app needs it to open full-screen.

## 6. Cron job for alert retries

New-order alerts are sent the moment an order is placed. Anything that fails is retried by this cron job. In **Advanced → Cron Jobs**, add a job that runs every 5 minutes:

```bash
curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://exthrifts.com/api/cron/push
```

## 7. Before launch

Go through these in **Admin**:
- **Settings:** phone, WhatsApp, return address (it is printed on every slip), delivery fee and free-delivery threshold.
- **Storefront & pages:** fill in every page that still shows `[bracketed]` text, especially Returns, About and Terms.
- **Storefront:** hero text and photo, and the top-bar message.
- **Categories & collections:** adjust the starter categories.
- Add your first pieces, or create a drop.
- Place one real test order and print its slip. Check that the slip prints correctly on your printer, at 100% scale on A4 landscape.

## Updating

Push to `main` and Hostinger rebuilds. Migrations in `prisma/migrations` are applied by `build:deploy` before the new code starts serving.

## Known limits

- `sharp`, the image converter, needs its Linux x64 binary. `npm install` fetches it automatically. If photo uploads fail with a server error after deploy, check the app logs for `sharp`.
- This is a single Node process. The admin login throttle and the push token cache live in memory and reset on restart, which is harmless.
- Parcel slips use the standard PDF fonts and cannot print Urdu script. Checkout asks for addresses in English.
