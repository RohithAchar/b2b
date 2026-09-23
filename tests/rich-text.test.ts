import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_HTML_CHARS,
  DESCRIPTION_MIN_TEXT_CHARS,
  defaultSeoDescription,
  defaultSeoTitle,
  plainTextLength,
  stripHtml,
  truncateTo,
} from "../lib/supplier/rich-text";
import { sanitizeRichText } from "../lib/supplier/sanitize";
import { productSchema } from "../lib/supplier/products";
import { resolveProductMetaDescription } from "../lib/product-meta";

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

describe("stripHtml", () => {
  it("returns plain text unchanged", () => {
    expect(stripHtml("Hello world")).toBe("Hello world");
  });

  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtml("<p>Tom &amp; Jerry &nbsp; &lt;ok&gt;</p>")).toBe("Tom & Jerry <ok>");
  });

  it("reduces a tag-only string to empty", () => {
    expect(stripHtml("<p><strong>&nbsp;</strong></p>")).toBe("");
  });
});

describe("plainTextLength", () => {
  it("counts only visible text, not markup", () => {
    expect(plainTextLength("<p>abc</p>")).toBe(3);
  });

  it("matches the seed description expected length", () => {
    const text =
      "Wholesale cotton school socks in ankle length, made by a verified Indian manufacturer with hand-finished seams and fade-resistant dye.";
    expect(plainTextLength(text)).toBe(text.length);
  });
});

describe("truncateTo", () => {
  it("returns short strings untouched", () => {
    expect(truncateTo("short", 10)).toBe("short");
  });

  it("truncates with an ellipsis", () => {
    const out = truncateTo("abcdefghijklmno", 10);
    expect(out.length).toBe(10);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("defaultSeoTitle", () => {
  it("caps at 60 characters", () => {
    const out = defaultSeoTitle("x".repeat(100));
    expect(out.length).toBe(60);
  });

  it("falls back to a placeholder for an empty title", () => {
    expect(defaultSeoTitle("   ")).toBe("Wholesale product");
  });
});

describe("defaultSeoDescription", () => {
  it("strips HTML before truncating", () => {
    const out = defaultSeoDescription(`<p>${"a".repeat(200)}</p>`);
    expect(out.length).toBe(160);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("productSchema description length", () => {
  it("accepts a rich description with enough visible text", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      description: "<p>One hundred percent cotton fabric in a fine plain weave.</p>",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a tag-only description despite a long raw length", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      description: `<p>${"&nbsp;".repeat(60)}</p>`,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain(
        String(DESCRIPTION_MIN_TEXT_CHARS),
      );
    }
  });

  it("rejects a description just under the visible-text minimum", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      description: "a".repeat(DESCRIPTION_MIN_TEXT_CHARS - 1),
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts exactly the visible-text minimum", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      description: "a".repeat(DESCRIPTION_MIN_TEXT_CHARS),
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects raw HTML above the 8000-character ceiling", () => {
    const parsed = productSchema.safeParse({
      ...baseProduct,
      description: `${"<p>ab</p>".repeat(DESCRIPTION_MAX_HTML_CHARS / 2)}text okay`,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain(
        String(DESCRIPTION_MAX_HTML_CHARS),
      );
    }
  });
});

describe("sanitizeRichText", () => {
  it("allows a safe rich-text subset and strips everything else", () => {
    const out = sanitizeRichText(
      '<script>alert(1)</script><p onclick="x()">Hello <strong>world</strong></p>',
    );
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).toContain("<p>Hello <strong>world</strong></p>");
  });

  it("forces links to open in a new tab with noopener", () => {
    const out = sanitizeRichText('<p><a href="https://example.com">Shop</a></p>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener');
  });

  it("drops javascript: links", () => {
    const out = sanitizeRichText('<p><a href="javascript:alert(1)">Bad</a></p>');
    expect(out).not.toContain("javascript:");
  });
});

describe("meta description falls back to stripped HTML", () => {
  it("strips tags from the product description fallback", () => {
    expect(
      resolveProductMetaDescription({
        title: "t",
        description: "<p>Wholesale cotton school socks.</p>",
        seo_title: null,
        seo_description: null,
      }),
    ).toBe("Wholesale cotton school socks.");
  });
});