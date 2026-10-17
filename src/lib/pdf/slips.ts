// Parcel slips: A4 landscape, four A6 slips per page (2 x 2) with dashed cut
// lines. Each slip carries the store's logo and return address, the customer's
// name, phone, address and city in large type, the items with size and price,
// and the cash-on-delivery total. Pure function of its inputs, so it is tested
// without a database.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export interface SlipItem {
  title: string;
  size: string | null;
  price: number;
  quantity: number;
}

export interface SlipOrder {
  label: string; // EXT-1001
  createdAt: Date;
  customerName: string;
  phone: string; // display form
  address: string;
  city: string;
  notes: string | null;
  items: SlipItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

export interface SlipStore {
  name: string;
  returnName: string;
  returnAddress: string;
  returnCity: string;
  phone: string;
}

export const SLIPS_PER_PAGE = 4;
const PAGE_W = 841.89; // A4 landscape, points
const PAGE_H = 595.28;
const SLOT_W = PAGE_W / 2;
const SLOT_H = PAGE_H / 2;
const PAD = 16;
const INK = rgb(0, 0, 0);
const GREY = rgb(0.35, 0.35, 0.35);
const RULE = rgb(0.75, 0.75, 0.75);

export function pageCount(orders: number): number {
  return Math.ceil(orders / SLIPS_PER_PAGE);
}

/** Top-left corner of slot 0..3 (reading order) in PDF coordinates (origin bottom-left). */
export function slotOrigin(index: number): { x: number; top: number } {
  const col = index % 2;
  const row = Math.floor(index / 2) % 2;
  return { x: col * SLOT_W, top: PAGE_H - row * SLOT_H };
}

/**
 * The standard PDF fonts only encode Latin-1 (WinAnsi). Replace typographic
 * punctuation with ASCII and anything else unencodable (e.g. Urdu) with "?",
 * rather than letting the whole PDF fail.
 */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E¡-ÿ]/g, "?");
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    // A single word longer than the line (long URLs, no spaces) is hard-cut.
    while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut -= 1;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}...`;
    return kept;
  }
  return lines;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  return wrapText(text, font, size, maxWidth, 1)[0] ?? "";
}

const rupees = (n: number) => `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(n)}`;

const dateLabel = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(d);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

function drawSlip(page: PDFPage, index: number, order: SlipOrder, store: SlipStore, fonts: Fonts, logo: PDFImage | null) {
  const { x, top } = slotOrigin(index);
  const left = x + PAD;
  const width = SLOT_W - PAD * 2;
  const bottom = top - SLOT_H + PAD;
  let y = top - PAD;

  // --- header: logo + store / return address -------------------------------
  const headerH = 40;
  let textLeft = left;
  if (logo) {
    const scale = headerH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, { x: left, y: y - headerH, width: w, height: headerH });
    textLeft = left + w + 10;
  } else {
    // Stamp-style fallback until the logo PNG is added.
    page.drawRectangle({ x: left, y: y - headerH, width: 92, height: headerH, borderColor: INK, borderWidth: 1.5 });
    page.drawText(fit(store.name.toUpperCase(), fonts.bold, 12, 84), { x: left + 6, y: y - 25, size: 12, font: fonts.bold, color: INK });
    textLeft = left + 102;
  }
  const textW = left + width - textLeft;
  page.drawText("RETURN TO", { x: textLeft, y: y - 8, size: 6.5, font: fonts.bold, color: GREY });
  const returnLines = [
    store.returnName || store.name,
    [store.returnAddress, store.returnCity].filter(Boolean).join(", "),
    store.phone ? `Ph: ${store.phone}` : "",
  ].filter(Boolean);
  let ry = y - 17;
  for (const line of returnLines.slice(0, 3)) {
    page.drawText(fit(line, fonts.regular, 8, textW), { x: textLeft, y: ry, size: 8, font: fonts.regular, color: INK });
    ry -= 10;
  }
  y -= headerH + 6;
  page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 0.8, color: INK });

  // --- customer -----------------------------------------------------------
  y -= 11;
  page.drawText("DELIVER TO", { x: left, y, size: 6.5, font: fonts.bold, color: GREY });
  page.drawText("CASH ON DELIVERY", {
    x: left + width - fonts.bold.widthOfTextAtSize("CASH ON DELIVERY", 6.5),
    y,
    size: 6.5,
    font: fonts.bold,
    color: GREY,
  });
  y -= 15;
  page.drawText(fit(order.customerName, fonts.bold, 13, width), { x: left, y, size: 13, font: fonts.bold, color: INK });
  y -= 16;
  page.drawText(fit(order.phone, fonts.bold, 14, width), { x: left, y, size: 14, font: fonts.bold, color: INK });
  y -= 13;
  for (const line of wrapText(order.address, fonts.regular, 10, width, 3)) {
    page.drawText(line, { x: left, y, size: 10, font: fonts.regular, color: INK });
    y -= 12;
  }
  page.drawText(fit(order.city.toUpperCase(), fonts.bold, 12, width), { x: left, y: y - 1, size: 12, font: fonts.bold, color: INK });
  y -= 14;
  if (order.notes) {
    const note = wrapText(`Note: ${order.notes}`, fonts.regular, 7.5, width, 1)[0];
    page.drawText(note, { x: left, y, size: 7.5, font: fonts.regular, color: GREY });
    y -= 10;
  }
  y -= 2;
  page.drawLine({ start: { x: left, y }, end: { x: left + width, y }, thickness: 0.8, color: INK });

  // --- items ---------------------------------------------------------------
  const sizeX = left + width - 120;
  const priceRight = left + width;
  y -= 10;
  page.drawText("ITEM", { x: left, y, size: 6.5, font: fonts.bold, color: GREY });
  page.drawText("SIZE", { x: sizeX, y, size: 6.5, font: fonts.bold, color: GREY });
  page.drawText("PRICE", { x: priceRight - fonts.bold.widthOfTextAtSize("PRICE", 6.5), y, size: 6.5, font: fonts.bold, color: GREY });

  const footerH = 14;
  const totalsH = 12 * 2 + 16 + (order.discount ? 10 : 0);
  const rowH = 10.5;
  const roomForRows = Math.floor((y - 4 - (bottom + footerH + totalsH)) / rowH);
  const needsMore = order.items.length > roomForRows;
  const shown = needsMore ? Math.max(roomForRows - 1, 0) : order.items.length;

  for (const item of order.items.slice(0, shown)) {
    y -= rowH;
    const title = item.quantity > 1 ? `${item.quantity} x ${item.title}` : item.title;
    page.drawText(fit(title, fonts.regular, 8.5, sizeX - left - 8), { x: left, y, size: 8.5, font: fonts.regular, color: INK });
    page.drawText(fit(item.size ?? "-", fonts.regular, 8.5, 56), { x: sizeX, y, size: 8.5, font: fonts.regular, color: INK });
    const price = rupees(item.price * item.quantity);
    page.drawText(price, { x: priceRight - fonts.regular.widthOfTextAtSize(price, 8.5), y, size: 8.5, font: fonts.regular, color: INK });
  }
  if (needsMore) {
    y -= rowH;
    const more = order.items.length - shown;
    page.drawText(`+${more} more item${more === 1 ? "" : "s"}`, { x: left, y, size: 8.5, font: fonts.bold, color: INK });
  }

  // --- totals (anchored above the footer) ------------------------------------
  let ty = bottom + footerH + totalsH - 4;
  page.drawLine({ start: { x: left, y: ty + 6 }, end: { x: left + width, y: ty + 6 }, thickness: 0.5, color: RULE });
  const row = (label: string, value: string, size: number, font: PDFFont) => {
    page.drawText(label, { x: sizeX - 40, y: ty, size, font, color: INK });
    page.drawText(value, { x: priceRight - font.widthOfTextAtSize(value, size), y: ty, size, font, color: INK });
  };
  ty -= 6;
  row("Subtotal", rupees(order.subtotal), 8, fonts.regular);
  ty -= 10;
  row("Delivery", order.shipping ? rupees(order.shipping) : "Free", 8, fonts.regular);
  if (order.discount) {
    ty -= 10;
    row("Discount", `-${rupees(order.discount)}`, 8, fonts.regular);
  }
  ty -= 15;
  row("TOTAL (COD)", rupees(order.total), 12, fonts.bold);

  // --- footer ----------------------------------------------------------------
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
  page.drawText(pdfSafe(`${order.label}  -  ${dateLabel(order.createdAt)}`), {
    x: left,
    y: bottom,
    size: 7,
    font: fonts.regular,
    color: GREY,
  });
  const count = `${pieces} piece${pieces === 1 ? "" : "s"}`;
  page.drawText(count, { x: priceRight - fonts.regular.widthOfTextAtSize(count, 7), y: bottom, size: 7, font: fonts.regular, color: GREY });
}

function drawCutLines(page: PDFPage, font: PDFFont) {
  const dash = { thickness: 0.6, color: RULE, dashArray: [4, 3] };
  page.drawLine({ start: { x: SLOT_W, y: 0 }, end: { x: SLOT_W, y: PAGE_H }, ...dash });
  page.drawLine({ start: { x: 0, y: SLOT_H }, end: { x: PAGE_W, y: SLOT_H }, ...dash });
  page.drawText("cut", { x: SLOT_W + 3, y: PAGE_H - 10, size: 6, font, color: RULE });
  page.drawText("cut", { x: 3, y: SLOT_H + 3, size: 6, font, color: RULE });
}

export async function renderSlipsPdf(orders: SlipOrder[], store: SlipStore, logoPng?: Uint8Array | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${pdfSafe(store.name)} parcel slips`);
  pdf.setCreator(pdfSafe(store.name));
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  let logo: PDFImage | null = null;
  if (logoPng?.length) {
    try {
      logo = await pdf.embedPng(logoPng);
    } catch {
      logo = null;
    }
  }
  const safeStore: SlipStore = {
    name: pdfSafe(store.name),
    returnName: pdfSafe(store.returnName),
    returnAddress: pdfSafe(store.returnAddress),
    returnCity: pdfSafe(store.returnCity),
    phone: pdfSafe(store.phone),
  };

  let page: PDFPage | null = null;
  orders.forEach((order, i) => {
    const slot = i % SLIPS_PER_PAGE;
    if (slot === 0) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawCutLines(page, fonts.regular);
    }
    drawSlip(page!, slot, { ...order, customerName: pdfSafe(order.customerName), phone: pdfSafe(order.phone), city: pdfSafe(order.city) }, safeStore, fonts, logo);
  });
  if (!orders.length) pdf.addPage([PAGE_W, PAGE_H]);
  return pdf.save();
}
