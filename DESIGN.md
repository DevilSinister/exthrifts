---
name: ExThrifts
description: A rack of tagged one-offs. One-of-one vintage, cash on delivery across Pakistan.
colors:
  ink: "#0d0d0c"
  ink-soft: "#2a2927"
  muted: "#55534e"
  rule: "#cfccc4"
  sunken: "#e9e7e1"
  paper: "#f4f3ef"
  card: "#ffffff"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.4rem; 4.5rem from 640px; 5.5rem from 1024px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 62"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 62"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem; 3rem from 640px"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 62"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontVariation: "\"wdth\" 100"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    fontVariation: "\"wdth\" 75"
  tag:
    fontFamily: "Courier Prime, ui-monospace, Courier New, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    letterSpacing: "0"
    fontFeature: "tnum"
  tag-price:
    fontFamily: "Courier Prime, ui-monospace, Courier New, monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    letterSpacing: "0"
    fontFeature: "tnum"
rounded:
  tag: "3px"
  stamp: "4px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  grid-gap: "12px"
  grid-gap-wide: "20px"
  panel: "20px"
  section: "64px"
  container: "80rem"
components:
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.tag}"
    padding: "0 20px"
    height: "44px"
  button-ink-hover:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.paper}"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "0 20px"
    height: "44px"
  button-line-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "0 20px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.sunken}"
  button-sm:
    rounded: "{rounded.tag}"
    padding: "0 14px"
    height: "36px (44px on coarse pointers)"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "10px 12px"
    height: "44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "0 8px"
    height: "24px"
  chip-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.tag}"
  chip-muted:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
  hang-tag:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "36px 20px 24px"
  stamp:
    textColor: "{colors.ink}"
    rounded: "{rounded.stamp}"
    padding: "0.2em 0.6em"
  countdown-cell:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "8px 16px"
---

# Design System: ExThrifts

## Overview

**Creative North Star: "The Hang-Tag Rack"**

ExThrifts is a rack of tagged one-offs. Every piece is presented the way a thrift store presents it: hung on paper, labelled with a stamped heading, its facts typed onto a tag, its sale marked with a rubber stamp. The system deliberately refuses the category default for streetwear stores (glossy lifestyle grids, colour accents, promo badges) and replaces it with a physical vocabulary of paper, ink, typewriter facts and perforations.

The world is strictly monochrome: warm paper and near-black ink, with four greys doing structural work only. Product photography is the single source of colour on the page and the interface never competes with it. Density is moderate: a two-column grid on phones, four on desktop, with every card carrying its size, measurements and condition under the photo so a shopper can judge fit without opening the listing. The admin speaks the same language as the store; status is told through shape and fill, never colour.

Depth is flat paper with one exception: a hard, unblurred ink offset shadow, used only on "tag" objects that hang off the rack (the product hang-tag, the order receipt, the fanned hero cards, the sign-in card).

**Key Characteristics:**
- Paper (#f4f3ef) and ink (#0d0d0c) only; greys for structure; colour comes from photos alone.
- Condensed heavy Archivo (width 62, weight 800, uppercase) for every heading, set like a stamped label.
- Courier Prime for every fact a buyer decides on: size, measurements, condition, price, order numbers, dates.
- Dashed perforated tear lines as dividers; dashed borders as the system's "not solid yet" state.
- 2px ink borders and a 3px tag radius; no pill-shaped text containers.
- SOLD is a rotated, double-bordered rubber stamp, and sold photos go grey.
- One hard ink offset shadow reserved for hanging tag objects.

## Colors

A monochrome warm-paper palette in which ink carries every emphasis and greys only build structure.

### Primary
- **Press Ink** (#0d0d0c): The one voice. Body text, all 2px borders, primary buttons, the announcement bar, the drop band, the footer, selected states, solid chips, focus outlines and the text-selection fill. Also the browser theme colour.

### Neutral
- **Worn Ink** (#2a2927): Hover state of ink buttons and of the announcement-bar drop link, and long-form secondary copy (hero subtitle, product description, delivery notes).
- **Faded Type** (#55534e): Muted text: fact labels in the hang-tag table, card facts, placeholders, countdown units, empty-state copy. Holds 6.9:1 on paper.
- **Pencil Rule** (#cfccc4): Quiet tear lines, empty-state dashed frames, the phone category-row divider, muted chip borders.
- **Shelf Grey** (#e9e7e1): Sunken surfaces: photo wells behind images, ghost-button hover, selected admin order rows.
- **Tag Paper** (#f4f3ef): The page itself, text on ink, the eyelet hole, inverse buttons on the drop band.
- **Card Stock** (#ffffff): Raised paper: product hang-tag, countdown cells, panels, category tiles, form fields.

### Named Rules
**The Photo Owns Colour Rule.** The interface is ink, paper and greys; the only colour on any screen is product photography. Never introduce a UI accent, coloured badge or status hue. This rule governs chrome, not photos: photos stay full colour (except sold pieces, which go grayscale).

**The Translucent Ink Rule.** On ink grounds, hierarchy comes from paper at reduced opacity (80% for body, 70% for labels and the copyright line, 30-40% for dashed dividers), not from new greys.

## Typography

**Display Font:** Archivo variable, width axis (with ui-sans-serif, system-ui)
**Body Font:** Archivo variable at width 100 (same family)
**Label/Mono Font:** Courier Prime 400/700 (with ui-monospace, Courier New)

**Character:** One grotesk stretched across its width axis does both jobs: squeezed to 62 and set at 800 it is a stamped garment label; at normal width it is quiet body text. Courier Prime is the typewriter that fills in the tag, so any fact set in it reads as recorded rather than marketed.

### Hierarchy
- **Display** (800, 3.4rem rising to 5.5rem, 0.92, uppercase, width 62): The home hero H1 only, stacked over several lines.
- **Headline** (800, 2.25rem, 0.92, uppercase, width 62): Section heads ("Shop by rack", "Just in", "More from this rack"); 3-3.75rem for the drop band name and drop page H1.
- **Title** (800, 2.25rem to 3rem, 0.92, uppercase, width 62): Product H1 inside the hang-tag; admin page H1s.
- **Body** (400-600, 1rem, ~1.5): Running copy; product description capped at `max-width: 65ch`; card titles at 0.9375rem semibold, two-line clamp.
- **Label** (700, 0.75rem, 0.06em, uppercase, width 75): Eyebrows, section labels inside panels, footer column heads, marquee phrases (0.6875rem), "See all" links, tile names (0.8125rem). Buttons use the same voice at width 80, 0.9375rem, 0.04em.
- **Tag** (Courier Prime, 0.8125-0.9375rem, tabular numerals): Facts lines on cards, the hang-tag facts table, order numbers, dates, phone numbers, totals. Price is Tag at 700, 1.5rem on the product page and 0.9375rem on cards.

### Named Rules
**The Typed Fact Rule.** If a shopper or the owner decides on it (size, measurement, condition, price, total, order number, time), it is set in Courier Prime with tabular numerals. Marketing copy never is.

**The Stamped Heading Rule.** Every H1-H3 that names a thing is condensed, heavy, uppercase Archivo with tight 0.92 leading and balanced wrapping. Do not set headings in the regular width.

## Layout

A single centred container (max 80rem) with a 16px gutter on phones and 24px from 640px. Sections are separated by generous top padding (56-64px, 80px before related products) rather than rules. The product grid is 2 columns on phones, 3 at 768px and 4 at 1024px, with 12px column gaps (20px from 640px) and a taller 28px row gap so each card's facts breathe. Category tiles run 2, 3, then 6 across.

The store header is sticky: a 36px ink announcement bar (drop countdown pinned left, marquee right), then a 64px paper header with a 2px ink bottom rule (logo tag, centred category menu at 1024px+, search, cart). Below 1024px the categories become a swipeable chip row under a dashed rule. The product page is a 1.15fr / 1fr split from 768px with the hang-tag sticky beside a stacked gallery; on phones the gallery is a snap-scrolling swipe strip. The admin is a 15rem sidebar from 768px and a fixed five-slot bottom bar on phones; the orders list is a stacked card below 1024px and a five-column row at 1024px+ (number, name over phone, date, total, status).

Touch floor: every tappable control is at least 44px on phones (buttons, fields, chips in the category row, header icons, footer links, compact buttons on coarse pointers). Amounts never wrap. Nothing scrolls horizontally at 375px except the deliberate category and gallery strips.

## Elevation & Depth

The world is flat paper. Surfaces separate by tone (paper, card stock, shelf grey) and by 2px ink borders, not by shadow. The single exception is the hard ink offset shadow: a crisp, unblurred block of ink offset down and right, as if the tag were hanging slightly proud of the rack. It belongs to tag objects only.

### Shadow Vocabulary
- **Tag Offset** (`box-shadow: 5px 6px 0 rgba(13,13,12,0.9)`): The product hang-tag, the order-confirmation receipt, the admin sign-in card.
- **Small Tag Offset** (`box-shadow: 4px 6px 0 rgba(13,13,12,0.9)`): Smaller hanging objects: the fanned hero tag cards and the floating device-pairing notice.

### Named Rules
**The Hanging Tag Rule.** Only a tag-like object that stands for one piece or one transaction gets the offset shadow. Grids, panels, buttons and fields stay flat. Never use a blurred or diffuse shadow.

## Shapes

Corners are a barely-there 3px tag radius on every text-bearing control (buttons, fields, chips, the sale label, admin nav items); the SOLD stamp uses 4px. Large containers (hang-tag, panels, tiles, countdown cells, images) are square-cornered with a 2px ink border. Circles are reserved for things that are round in the physical world: the punched eyelet hole on the hang-tag, the marquee bullet dots, timeline nodes and the cart count dot.

Dashed lines carry meaning. A dashed rule is a perforated tear line (1.5px; ink on the tag, Pencil Rule elsewhere; also between footer rows and panel headers). A dashed border on a control means "not solid": a disabled button, an invalid field (2px dashed), a shipped or returned status chip, an empty state.

## Components

### Buttons
Blunt, label-voiced and heavy: they read like printed tag text.
- **Shape:** Tag radius (3px), 2px ink border, 44px minimum height.
- **Primary (ink):** Press Ink fill, Tag Paper text, 20px side padding; uppercase Archivo 700 at width 80, 0.9375rem, 0.04em.
- **Line:** Transparent with ink border and ink text; fills to ink with paper text on hover. Used for the secondary hero action ("Next drop") and "Ask on WhatsApp".
- **Ghost:** Borderless; Shelf Grey on hover. Header category menu, icon buttons, sign out.
- **Small:** 36px on a mouse, 44px on coarse pointers, 14px padding, 0.8125rem.
- **Hover / Focus / Active:** 160ms colour change on an expo ease-out; 1px press-down on active; 2px ink focus outline offset 2px.
- **Disabled:** Border turns dashed at 55% opacity, not-allowed cursor.
- **Inverse:** On the ink drop band, a paper-filled button with ink text, Shelf Grey on hover.

### Chips
- **Style:** 24px tall, 1.5px ink border, 3px radius, uppercase 0.6875rem 700. Never pill-shaped.
- **State:** Status is shape, not colour: solid ink = New; outline = Processing; dashed = Shipped; muted grey = Delivered; muted struck-through = Cancelled; muted dashed = Returned. Solid ink also carries the "-N%" discount on the hang-tag. The phone category row uses chips at 44px height.

### Cards / Containers
- **Product card:** No frame. A 4:5 Shelf Grey photo well, then title, a Courier facts line (size · chest×length″ · grade/10) in Faded Type, and a Courier bold price. Hover swaps to the second photo (300ms fade). Sold: photo grayscale at 60%, paper-backed SOLD stamp centred, price struck through.
- **Panels / tiles:** Card Stock, 2px ink border, square corners; panel headers sit above a dashed ink tear line. Category tiles end in an ink-ruled label strip with an arrow; a tile with no cover shows its name as a muted display word.
- **Internal Padding:** 16-20px.

### Inputs / Fields
- **Style:** Card Stock fill, 1.5px ink border, 3px radius, 44px tall, 1rem text (prevents iOS zoom), Faded Type placeholders. Selects carry an inline ink chevron. Admin example placeholders start with "e.g.".
- **Focus:** 2px ink outline, 1px offset.
- **Error:** Border becomes 2px dashed.

### Navigation
- **Store:** Ink announcement bar with a pinned Courier countdown ("NEXT DROP 01:21:01") behind a dashed paper divider, then a 38s marquee of label-voice phrases that pauses on hover and stops for reduced motion. The header menu is ghost-small buttons in label voice; on phones it becomes a horizontal chip row. The footer is an ink slab with the inverted logo tag and label-voice column heads.
- **Admin:** Sidebar list items at 3px radius; active is ink-filled with paper text, hover Shelf Grey. Phone bottom bar of five label-voice slots, active slot filled ink, "More" opens a sheet of bordered tiles.

### Drop Countdown
Four Card Stock cells with 2px ink borders (DAYS / HRS / MIN / SEC), Courier bold tabular digits (1.875-2.25rem in the home band, 3-4.5rem on drop pages) over a muted label-voice unit. Driven by server time so it is honest to the second.

### The Hang-Tag (signature component)
The product page's buying panel is a literal hang-tag: Card Stock, 2px ink border, Tag Offset shadow, a punched eyelet (14px paper circle with a 2px ink ring) centred at the top, a muted label eyebrow (brand · era), the product title in stamped display, the Courier price, a dashed ink tear line, then a two-column Courier facts table (muted label, ink value: size, pit-to-pit, length, condition grade and notes) and "Measured flat, in inches." The actions sit below. When sold, a rotated (-8deg) double-bordered SOLD stamp lands at its top right and the price is struck through. The order receipt and hero rack cards are derived from this object.

## Do's and Don'ts

### Do:
- **Do** keep every UI surface to Press Ink, Tag Paper and the four structural greys; let photos be the only colour.
- **Do** set every decision-making fact (size, measurements, condition, price, totals, order numbers, dates) in Courier Prime with tabular numerals.
- **Do** set headings in condensed Archivo (width 62, weight 800, 0.92 leading, uppercase).
- **Do** divide with 1.5px dashed tear lines, and use a dashed border to mean disabled, invalid, in-transit or empty.
- **Do** use the 3px tag radius on buttons, fields and chips, and 2px ink borders on containers.
- **Do** express status through fill and border style (solid, outline, dashed, muted, struck), never hue.
- **Do** mark sold pieces with the rotated double-border SOLD stamp and a grayscale photo.
- **Do** hold a 44px minimum on every phone tap target, including compact buttons on coarse pointers.
- **Do** list available pieces before sold ones in any curated row.

### Don't:
- **Don't** add a colour accent, coloured status or gradient to the interface.
- **Don't** use pill-shaped buttons, chips or labels; circles are only for eyelets, bullet dots, timeline nodes and count dots.
- **Don't** use blurred or diffuse shadows; the only shadow is the hard ink offset, and only on hanging tag objects.
- **Don't** set prices or measurements in the body sans, or headings in the regular width.
- **Don't** let an amount wrap across lines.
- **Don't** ship fake proof: no invented review counts, follower numbers or trust badges.
- **Don't** run the marquee or decorative motion when reduced motion is requested.
