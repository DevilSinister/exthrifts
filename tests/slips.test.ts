import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pageCount, pdfSafe, renderSlipsPdf, slotOrigin, wrapText, type SlipOrder } from "@/lib/pdf/slips";

const store = {
  name: "ExThrifts",
  returnName: "ExThrifts Returns",
  returnAddress: "Shop 4, Test Market",
  returnCity: "Lahore",
  phone: "0300 0000000",
};

function order(n: number, itemCount = 2): SlipOrder {
  return {
    label: `EXT-${1000 + n}`,
    createdAt: new Date("2026-10-17T10:00:00Z"),
    customerName: `Test Buyer ${n}`,
    phone: "0300 1234567",
    address: "House 12, Street 4, Block C, Test Town, near the big mosque and the blue gate",
    city: "Karachi",
    notes: n % 2 ? "Call before delivery" : null,
    items: Array.from({ length: itemCount }, (_, i) => ({
      title: `Vintage piece number ${i + 1} with a long descriptive title`,
      size: "L",
      price: 1500 + i * 100,
      quantity: 1,
    })),
    subtotal: 3100,
    shipping: 250,
    discount: n % 3 === 0 ? 100 : 0,
    total: 3250,
  };
}

describe("slip layout", () => {
  it("puts four slips on a page", () => {
    expect(pageCount(1)).toBe(1);
    expect(pageCount(4)).toBe(1);
    expect(pageCount(5)).toBe(2);
    expect(pageCount(8)).toBe(2);
  });

  it("places slots in reading order", () => {
    expect(slotOrigin(0)).toEqual({ x: 0, top: 595.28 });
    expect(slotOrigin(1).x).toBeCloseTo(420.945);
    expect(slotOrigin(2)).toEqual({ x: 0, top: 297.64 });
    expect(slotOrigin(3).top).toBeCloseTo(297.64);
  });

  it("renders 5 orders onto 2 landscape A4 pages", async () => {
    const bytes = await renderSlipsPdf([1, 2, 3, 4, 5].map((n) => order(n)), store);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
  });

  it("renders an order with too many items without throwing", async () => {
    const bytes = await renderSlipsPdf([order(1, 25)], store);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("survives Urdu and emoji in customer text", async () => {
    const urdu = { ...order(2), address: "مکان نمبر 12، لاہور 🙂", customerName: "علی" };
    const bytes = await renderSlipsPdf([urdu], store);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

describe("pdf text helpers", () => {
  it("maps typographic punctuation and drops unencodable characters", () => {
    expect(pdfSafe("Levi’s “501” — size M…")).toBe("Levi's \"501\" - size M...");
    expect(pdfSafe("علی")).toBe("???");
  });

  it("wraps and truncates to the line limit", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("one two three four five six seven eight nine ten", font, 10, 60, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("...")).toBe(true);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(60);
  });
});
