# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(The admin is also opened inside a small Android Trusted Web Activity used only for new-order alerts; its design language is still the website's.)

## Users

- **Shoppers:** mostly Gen Z streetwear buyers in Pakistan, roughly 16–25, who arrive from Instagram and TikTok on their phones. They hunt vintage band tees, football jerseys, baggy denim, leather jackets and caps, and they know a piece will be gone if they hesitate.
- **The owner and staff:** list pieces from a phone, schedule drops, watch orders arrive, print parcel slips four to an A4 sheet, and move orders through processing, shipping and delivery.

## Product Purpose

ExThrifts sells hand-picked, one-of-one vintage clothing with cash on delivery anywhere in Pakistan. Success is a shopper finding a piece in their size, trusting its condition from the listing alone, and checking out before someone else does; and the owner turning each day's orders into labelled parcels with as little admin as possible.

## Positioning

Every piece is a single piece with real measurements and an honest condition grade. Pieces release in scheduled drops with a public countdown. Adding to cart never holds an item: whoever checks out first gets it. Sold pieces stay visible with a SOLD mark for seven days, then leave the shop.

## Operating Context

- Shoppers browse on mid-range Android phones on mobile data; product photos are the main content.
- Drops are announced on Instagram and counted down in the site's top bar.
- Payment is cash on delivery only; the courier collects the total printed on the slip.
- The owner works from a phone: a push alert opens the order, and slips are printed in batches and cut by hand.
- Hosted on Hostinger (Node.js app + MySQL); photos stored on the server's disk.

## Capabilities and Constraints

- Products: title, photos with alt text, price and optional compare-at price, size, measurements in inches, condition grade out of 10 with notes, brand, era, category, collections, tags. Stock defaults to 1.
- Drops: draft products grouped and scheduled; they go live exactly at the start time.
- Checkout fields: name, Pakistani mobile number, city, full address, optional email and notes, optional discount code.
- Order statuses: New, Processing, Shipped, Delivered, Cancelled, Returned. Printing slips moves New orders to Processing.
- Store name and domain come from environment variables; the default is "ExThrifts" at exthrifts.com.
- English only for now. The parcel PDF cannot print Urdu script.

## Brand Commitments

- Name: ExThrifts.
- Logo: a black-and-white vintage stamp/badge.
- Colour: black, white and greys only.
- Voice: clean and direct. Short, confident, correctly spelled English with a little attitude. No slang overload, no emoji-heavy copy.
- Owner's layout direction: like thriftoriginals.com — minimal and easy to navigate: scrolling announcement bar, header with logo, a short category menu, search and cart, hero, category tiles, product grid, simple footer. That site is a reference for structure only; none of its copy or assets are used.

## Evidence on Hand

- No reviews, customer counts, press or follower numbers exist yet. The site must not invent any.
- The owner will add real reviews and an Instagram link later from admin. Proof sections stay hidden until that content exists.
- No product photography exists yet; local demo data uses labelled placeholders only.

## Product Principles

1. The listing is the fitting room: measurements, condition and flaws are always visible before the price decision.
2. First to check out wins, and the interface says so plainly rather than implying a hold.
3. A drop is an event: the countdown is honest to the second and nothing leaks early.
4. The owner's day is orders to parcels: every admin screen is usable one-handed on a phone.
5. Never fake trust. Show real proof or nothing.

## Accessibility & Inclusion

WCAG 2.2 AA contrast with a monochrome palette, 44px touch targets, one H1 per page, and no horizontal scroll at 375px. Motion such as the scrolling announcement bar respects reduced-motion settings.
