import { describe, expect, it } from "vitest";
import {
  resolveProductMetaDescription,
  resolveProductMetaTitle,
} from "../lib/product-meta";
import { productSchema } from "../lib/supplier/products";

const baseProduct = {
  title: "Cotton School Socks 200 GSM",
  category_id: "00000000-0000-0000-0000-000000000000",
  brand: "",
  seller_sku: "SOCKS-001",
  hsn_code: "6115",
  description:
    "Wholesale cotton school socks in ankle length, made by a verified Indian manufacturer with hand-finished seams and fade-resistant dye.",
  unit: "pcs",
  price_per_unit: 25,
  moq: 10,
  stock_qty: 500,
  negotiable: false,
  sample_available: true,
  sample_price: 30,
  lead_time_days: 15,
  gst_rate: 5,
  packaging_details: "100 pairs per polybag",
  warranty_return: "Replacements for manufacturing defects",
  youtube_url: "",
};

describe("productSchema SEO fields", () => {
  it("defaults seo_title and seo_description to empty strings", () => {
    const parsed = productSchema.safeParse(baseProduct);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.seo_title).toBe("");
      expect(parsed.data.seo_description).toBe("");
    }
  });

  it("trims white-space-only seo values to empty", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      seo_title: "   ",
      seo_description: "\n\t",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.seo_title).toBe("");
      expect(parsed.data.seo_description).toBe("");
    }
  });

  it("trims seo values", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      seo_title: "  School socks wholesale ",
      seo_description: "  MOQ 10 pairs  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.seo_title).toBe("School socks wholesale");
      expect(parsed.data.seo_description).toBe("MOQ 10 pairs");
    }
  });

  it("rejects seo_title over 200 characters", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      seo_title: "x".repeat(201),
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("200");
  });

  it("accepts seo_title at exactly 200 characters", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      seo_title: "x".repeat(200),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects seo_description over 400 characters", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      seo_description: "y".repeat(401),
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("400");
  });
});

describe("resolveProductMetaTitle", () => {
  it("uses the custom seo title when present", () => {
    expect(
      resolveProductMetaTitle({
        title: "Cotton School Socks",
        description: "desc",
        seo_title: "School socks wholesale",
        seo_description: null,
      }),
    ).toBe("School socks wholesale");
  });

  it("trims the custom seo title", () => {
    expect(
      resolveProductMetaTitle({
        title: "Cotton School Socks",
        description: "desc",
        seo_title: "  School socks wholesale  ",
        seo_description: null,
      }),
    ).toBe("School socks wholesale");
  });

  it("falls back to the product title when seo title is blank", () => {
    expect(
      resolveProductMetaTitle({
        title: "Cotton School Socks",
        description: "desc",
        seo_title: "   ",
        seo_description: null,
      }),
    ).toBe("Cotton School Socks");
  });

  it("falls back to the product title when seo title is null", () => {
    expect(
      resolveProductMetaTitle({
        title: "Cotton School Socks",
        description: "desc",
        seo_title: null,
        seo_description: null,
      }),
    ).toBe("Cotton School Socks");
  });
});

describe("resolveProductMetaDescription", () => {
  it("uses the custom seo description when present", () => {
    expect(
      resolveProductMetaDescription({
        title: "t",
        description: "Long product description here.",
        seo_title: null,
        seo_description: "Short seo copy.",
      }),
    ).toBe("Short seo copy.");
  });

  it("falls back to the product description when seo description is blank", () => {
    expect(
      resolveProductMetaDescription({
        title: "t",
        description: "Wholesale cotton school socks.",
        seo_title: null,
        seo_description: "   ",
      }),
    ).toBe("Wholesale cotton school socks.");
  });

  it("returns short descriptions unmodified", () => {
    const description = "Short description.";
    expect(
      resolveProductMetaDescription({
        title: "t",
        description,
        seo_title: null,
        seo_description: null,
      }),
    ).toBe(description);
  });

  it("truncates long descriptions with an ellipsis at 160 characters", () => {
    const description = "a".repeat(200);
    const out = resolveProductMetaDescription({
      title: "t",
      description,
      seo_title: null,
      seo_description: null,
    });
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
  });

  it("truncates long seo descriptions the same way", () => {
    const seoDescription = "b".repeat(180);
    const out = resolveProductMetaDescription({
      title: "t",
      description: "c".repeat(200),
      seo_title: null,
      seo_description: seoDescription,
    });
    expect(out.length).toBeLessThanOrEqual(160);
  });
});