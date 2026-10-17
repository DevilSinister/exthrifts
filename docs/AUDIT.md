# Audit: thriftoriginals.com (reference store)

**Date:** 17 October 2026.

**Method:**
- Read-only GET requests: HTML, `/products.json`, `/collections.json`, `/meta.json`, `sitemap.xml`, `robots.txt`.
- A Lighthouse mobile run on the home page.
- No forms were submitted and no checkout was started.

**Status:** thriftoriginals.com is another business's store. It is a reference for structure only; ExThrifts copies none of its copy, photos or assets.

## Scores

| Lighthouse (mobile, home) | Score |
|---|---|
| Accessibility | 95 |
| Best practices | 77 |
| SEO | 92 |

**Lighthouse failures:**
- Grey compare-at prices at 2.84:1 contrast.
- Heading order skips levels in the footer.
- No meta description.
- A third-party cookie.
- Issues logged in DevTools.

## Platform and catalogue

- **Platform:** Shopify with the free Horizon theme. Most of the look comes from custom Liquid sections. Prices are in PKR.
- **Catalogue size:** 274 published products. The sitemap lists only 236 of them.
- **Sold-out share:** about **77% (211 of 274)**. These are still listed, still appear in "Hot selling" and in cart recommendations, and are still indexed.
- **Size data:** 248 of 250 sampled products have a single "Default Title" variant, so **size isn't structured and can't be filtered**. Measurements (chest, length) and condition (e.g. "10/10") appear only as free text in descriptions.
- **Brand and type:** the vendor field is always the store's own name, so real brands are never captured. Product type is empty on about half the catalogue.
- **Tags:** inconsistent, e.g. "Baggy Jeans" vs "Baggy jeans".
- **URLs and titles:** 77 URL handles end in `-copy` (duplicated listings), many don't match the product title, and 8 titles are duplicates.
- **Images:** 532 of 952 are WhatsApp exports and 18 are 3024×4032 camera originals. The hero is a 534 KB JPEG and is still JPEG at `width=1200`.

## Navigation and trust

**Links**
- **9 of 11 footer links return 404:** Vintage, Grunge & Metal, New Drops, Shipping Info, Returns & Exchanges, FAQs, About Us, Privacy Policy and Terms.
- The menu item "Vtg Zippers" opens the hoodies collection.
- The Instagram, TikTok and Facebook icons link to `#`.

**Policies and contact details**
- Only Shopify's generated privacy policy exists.
- There are no refund, shipping, terms, contact-information, about or FAQ pages.
- **No delivery fee, delivery time or return window is stated anywhere.**
- There is no WhatsApp, phone number or address.

**Things that look like trust signals but aren't**
- The newsletter form has `onsubmit="return false;"`, so typed emails are thrown away.
- The testimonials are hard-coded.
- The payment "badges" are plain text.
- The "est 2022, 4000+ customers" claim isn't supported anywhere on the site.

## Page structure (reference only)

**Home page, top to bottom:**
1. Scrolling announcement bar.
2. Logo and a short menu.
3. Hero.
4. Category tiles.
5. Brand statement.
6. "Hot selling" grid.
7. Testimonials.
8. Contact form.
9. Footer with a newsletter signup.

**Product page:** gallery, title, price, quantity, add to cart, description, related items.
- There is no size field, size chart, brand, shipping or returns note, or WhatsApp button.

**Collection pages:** filters cover availability and price only.

## SEO

| | Home | Collection | Product |
|---|---|---|---|
| Title | Store name only | OK | OK |
| Meta description | Missing | Missing | Auto-generated from the description |
| Canonical | Missing | Present | Present |
| H1 | Two | One | One |
| JSON-LD | Organization | Organization | Product + Offer; no itemCondition, brand, size or breadcrumb |

**Other SEO findings**
- The home page has no `og:image`.
- The product `og:image` is served over `http://`.
- Every gallery image on a product page has the same alt text.
- The empty blog and a `frontpage` collection are in the sitemap.

## Performance and front end

- **Page weight:** home HTML is about 200 KB, `/collections/all` about 600 KB and `/search` about 856 KB. The cart drawer and predictive-search markup are injected into every page.
- **Lazy loading:** 24 of 25 home images are lazy-loaded, possibly including the above-the-fold hero.
- **Fonts and copy:** three font families are mixed (Inter, Arial, Georgia), and the copy has typos throughout.
- **Tracking:** there is no analytics or marketing pixel.

## What ExThrifts does about each finding

| Finding | ExThrifts |
|---|---|
| Size and measurements are free text | Structured `size`, a `measurements` table (chest, length, shoulder, sleeve, waist, inseam), `conditionGrade` 1–10 with notes, `brand`, `era`. Filterable by size, brand, condition and price. |
| 77% sold-out clutter | Sold pieces show a SOLD stamp for 7 days, then leave listings and the sitemap. Old links still open, with `noindex`. |
| Policy pages 404 | Shipping, Returns, FAQ, About, Privacy and Terms are seeded as editable pages and linked from the footer. Admin warns while any page still contains `[placeholder]` text. |
| No delivery or returns info | Delivery fee, free-delivery threshold, delivery-time text and a returns summary are admin settings shown on product pages, in the cart and at checkout. |
| No contact channel | WhatsApp "ask about this piece" button, contact page, and social links that only render when set. |
| Fake trust signals | No hard-coded testimonials or counts. The reviews section stays hidden until the owner enters real ones. |
| Dead newsletter form | Not built. No form that throws input away. |
| SEO gaps | Per-page titles, descriptions and canonicals; one H1 per page; Product JSON-LD with `UsedCondition`, brand, size and availability; BreadcrumbList; Organization; OG image; filtered and searched views marked `noindex`. |
| Heavy images | Uploads are converted to WebP at 400, 800 and 1600 px, with EXIF stripped. Only the first image loads eagerly. |
| Contrast and headings | Monochrome tokens checked for AA (muted text 6.9:1 on paper); one H1 per page. |
| `-copy` handles | Slugs come from titles with automatic de-duplication (`-2`, `-3`). The duplicate action creates a fresh draft without photos. |

## Not verified

- The reference store's actual checkout payment and shipping options. Checking them would mean starting a checkout.
- Real page-load timings beyond the single Lighthouse run.
