import { z } from "zod";
import { isSupportedImageType, sniffImageType } from "@/lib/storage";
import {
  DESCRIPTION_MAX_HTML_CHARS,
  DESCRIPTION_MIN_TEXT_CHARS,
  MAX_SEO_DESCRIPTION_CHARS,
  MAX_SEO_TITLE_CHARS,
  plainTextLength,
} from "@/lib/supplier/rich-text";

export const PRODUCT_UNITS = ["pcs", "kg", "box", "mtr", "ltr"] as const;
export const PRODUCT_GST_RATES = [0, 5, 12, 18, 28] as const;
export const PRODUCT_STATUSES = ["draft", "pending", "approved", "rejected"] as const;

export const MAX_PRODUCT_IMAGES = 8;
export const MIN_PRODUCT_IMAGES = 3;
export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_VARIANTS = 20;

// SEO size constants live in rich-text.ts (imported by client + tests).
export {
  MAX_SEO_TITLE_CHARS,
  MAX_SEO_DESCRIPTION_CHARS,
  SEO_TITLE_RECOMMENDED_CHARS,
  SEO_DESCRIPTION_RECOMMENDED_CHARS,
} from "@/lib/supplier/rich-text";

const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().match(YOUTUBE_ID_RE);
  return m?.[1] ?? null;
}

export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function youtubeThumbUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export async function validateProductImageFile(file: File | null): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    return "Each image must be under 2 MB.";
  }
  const detected = await sniffImageType(file);
  if (!isSupportedImageType(detected)) {
    return "Only JPG, PNG or WEBP images are allowed.";
  }
  return null;
}

export const priceSlabSchema = z.object({
  min_qty: z.coerce.number().int().min(1, "Min qty must be at least 1."),
  price: z.coerce.number().positive("Slab price must be positive."),
});

export const productVariantSchema = z.object({
  label: z.string().trim().min(2, "Variant label is required."),
  attr_key: z.string().trim().max(40).optional().default(""),
  attr_value: z.string().trim().max(40).optional().default(""),
  seller_sku: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-_]{3,30}$/i, "SKU: 3-30 chars, letters/numbers/-/_ ."),
  price: z.coerce.number().positive("Variant price must be positive."),
  moq: z.coerce.number().int().min(1).optional().nullable(),
  stock_qty: z.coerce.number().int().min(0).default(0),
});

export const productSchema = z.object({
  title: z.string().trim().min(10, "Title needs at least 10 characters.").max(140),
  category_id: z.string().uuid("Pick a subcategory."),
  brand: z.string().trim().max(60).optional().default(""),
  seller_sku: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-_]{3,30}$/i, "SKU: 3-30 chars, letters/numbers/-/_ ."),
  hsn_code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "HSN must be 4-8 digits."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(DESCRIPTION_MAX_HTML_CHARS)
    .refine(
      (v) => plainTextLength(v) >= DESCRIPTION_MIN_TEXT_CHARS,
      `Description needs at least ${DESCRIPTION_MIN_TEXT_CHARS} characters of text.`,
    ),
  unit: z.enum(PRODUCT_UNITS),
  price_per_unit: z.coerce.number().positive("Price must be positive."),
  moq: z.coerce.number().int().min(1, "MOQ must be at least 1."),
  stock_qty: z.coerce.number().int().min(0).default(0),
  negotiable: z.coerce.boolean().default(false),
  sample_available: z.coerce.boolean().default(false),
  sample_price: z.coerce.number().positive().optional().nullable(),
  lead_time_days: z.coerce.number().int().min(1).max(90),
  gst_rate: z.coerce
    .number()
    .refine((v) => (PRODUCT_GST_RATES as readonly number[]).includes(v), "Pick a valid GST rate."),
  packaging_details: z.string().trim().max(1000).optional().default(""),
  warranty_return: z.string().trim().max(1000).optional().default(""),
  youtube_url: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine(
      (v) => v === "" || extractYoutubeId(v) !== null,
      "Enter a valid YouTube link (watch / youtu.be / embed / shorts).",
    ),
  seo_title: z.string().trim().max(MAX_SEO_TITLE_CHARS).optional().default(""),
  seo_description: z.string().trim().max(MAX_SEO_DESCRIPTION_CHARS).optional().default(""),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;
export type ProductVariantValues = z.output<typeof productVariantSchema>;

export const PRODUCT_STEP_FIELDS = [
  ["title", "category_id", "brand", "seller_sku", "hsn_code", "description"],
  ["unit", "price_per_unit", "moq", "stock_qty", "negotiable", "sample_available", "sample_price", "lead_time_days", "gst_rate"],
  ["packaging_details", "warranty_return", "youtube_url"],
] as const;

export const productStepSchemas = [
  productSchema.pick({
    title: true,
    category_id: true,
    brand: true,
    seller_sku: true,
    hsn_code: true,
    description: true,
  }),
  productSchema.pick({
    unit: true,
    price_per_unit: true,
    moq: true,
    stock_qty: true,
    negotiable: true,
    sample_available: true,
    sample_price: true,
    lead_time_days: true,
    gst_rate: true,
  }),
  productSchema.pick({ packaging_details: true, warranty_return: true, youtube_url: true }),
] as const;
