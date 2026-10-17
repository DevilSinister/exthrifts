// Store settings edited in admin (Settings + Storefront pages). Stored as one
// JSON row per group in the Setting table and always read through these
// schemas, so a missing or malformed row falls back to the defaults below.
import { z } from "zod";
import { db } from "@/lib/db";

export const storeSchema = z.object({
  phone: z.string().max(30).default(""),
  whatsapp: z.string().max(30).default(""),
  email: z.string().max(120).default(""),
  returnName: z.string().max(80).default(""),
  returnAddress: z.string().max(240).default(""),
  returnCity: z.string().max(60).default(""),
  instagram: z.string().max(200).default(""),
  tiktok: z.string().max(200).default(""),
  facebook: z.string().max(200).default(""),
});

export const shippingSchema = z.object({
  flatRate: z.number().int().min(0).max(100000).default(250),
  freeOver: z.number().int().min(0).max(10000000).nullable().default(null),
  deliveryText: z.string().max(120).default("Delivered in 3–5 working days across Pakistan."),
  returnsText: z.string().max(200).default("Each piece is one of one. Check the measurements before ordering."),
});

export const announcementSchema = z.object({
  enabled: z.boolean().default(true),
  /** Shown after "Welcome to {site}" in the scrolling top bar. */
  text: z.string().max(160).default("Cash on delivery all over Pakistan"),
});

export const heroSchema = z.object({
  eyebrow: z.string().max(60).default("One of one vintage"),
  title: z.string().max(80).default("Vintage that doesn't come twice"),
  subtitle: z.string().max(200).default("Hand-picked jackets, tees, jerseys and denim. Every piece is a single piece."),
  ctaLabel: z.string().max(30).default("Shop the latest"),
  ctaHref: z.string().max(200).default("/shop"),
  imageKey: z.string().max(191).nullable().default(null),
});

/** Real customer words only. The home page hides this section while it's empty. */
export const proofSchema = z.object({
  reviews: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        city: z.string().trim().max(60).default(""),
        text: z.string().trim().min(1).max(400),
      }),
    )
    .max(6)
    .default([]),
});

export const SETTING_GROUPS = {
  store: storeSchema,
  shipping: shippingSchema,
  announcement: announcementSchema,
  hero: heroSchema,
  proof: proofSchema,
} as const;

export type SettingGroup = keyof typeof SETTING_GROUPS;
export type Settings = { [K in SettingGroup]: z.infer<(typeof SETTING_GROUPS)[K]> };

export function parseSettings(rows: Array<{ key: string; value: unknown }>): Settings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const result = {} as Record<string, unknown>;
  for (const [key, schema] of Object.entries(SETTING_GROUPS)) {
    const parsed = schema.safeParse(byKey.get(key) ?? {});
    result[key] = parsed.success ? parsed.data : schema.parse({});
  }
  return result as Settings;
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.setting.findMany();
  return parseSettings(rows);
}

export async function saveSettingGroup<K extends SettingGroup>(key: K, value: unknown): Promise<Settings[K]> {
  const parsed = SETTING_GROUPS[key].parse(value) as Settings[K];
  await db.setting.upsert({
    where: { key },
    create: { key, value: parsed as object },
    update: { value: parsed as object },
  });
  return parsed;
}
