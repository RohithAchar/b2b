import { describe, expect, it } from "vitest";
import type { ProductSort } from "../lib/storefront";

// ---------------------------------------------------------------------------
// Sort validation
// ---------------------------------------------------------------------------

const VALID_SORTS: ProductSort[] = ["relevance", "newest", "price_asc", "price_desc", "moq_asc"];

function parseSort(value: string | undefined): ProductSort {
  if (value && VALID_SORTS.includes(value as ProductSort)) {
    return value as ProductSort;
  }
  return "relevance";
}

describe("parseSort", () => {
  it("returns the sort value when valid", () => {
    expect(parseSort("newest")).toBe("newest");
    expect(parseSort("price_asc")).toBe("price_asc");
    expect(parseSort("price_desc")).toBe("price_desc");
    expect(parseSort("moq_asc")).toBe("moq_asc");
  });

  it("returns relevance for undefined", () => {
    expect(parseSort(undefined)).toBe("relevance");
  });

  it("returns relevance for invalid values", () => {
    expect(parseSort("invalid")).toBe("relevance");
    expect(parseSort("")).toBe("relevance");
    expect(parseSort("PRICE_ASC")).toBe("relevance");
  });
});

// ---------------------------------------------------------------------------
// Number parsing for filters
// ---------------------------------------------------------------------------

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

describe("parseNumber", () => {
  it("parses valid numbers", () => {
    expect(parseNumber("100")).toBe(100);
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("3.14")).toBe(3.14);
  });

  it("returns undefined for empty or invalid", () => {
    expect(parseNumber(undefined)).toBeUndefined();
    expect(parseNumber("")).toBeUndefined();
    expect(parseNumber("abc")).toBeUndefined();
    expect(parseNumber("-5")).toBeUndefined();
    expect(parseNumber("NaN")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Boolean parsing for filters
// ---------------------------------------------------------------------------

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

describe("parseBoolean", () => {
  it("parses true", () => {
    expect(parseBoolean("true")).toBe(true);
  });

  it("parses false", () => {
    expect(parseBoolean("false")).toBe(false);
  });

  it("returns undefined for other values", () => {
    expect(parseBoolean(undefined)).toBeUndefined();
    expect(parseBoolean("")).toBeUndefined();
    expect(parseBoolean("yes")).toBeUndefined();
    expect(parseBoolean("1")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// URL building for pagination with preserved state
// ---------------------------------------------------------------------------

function buildPageUrl(params: {
  query: string;
  categorySlug: string;
  sort: ProductSort;
  minPrice?: string;
  maxPrice?: string;
  minMoq?: string;
  maxMoq?: string;
  inStock?: string;
  negotiable?: string;
  sampleAvailable?: string;
  page: number;
}) {
  const sp = new URLSearchParams();
  if (params.query) sp.set("q", params.query);
  if (params.categorySlug) sp.set("category", params.categorySlug);
  if (params.sort !== "relevance") sp.set("sort", params.sort);
  if (params.minPrice) sp.set("minPrice", params.minPrice);
  if (params.maxPrice) sp.set("maxPrice", params.maxPrice);
  if (params.minMoq) sp.set("minMoq", params.minMoq);
  if (params.maxMoq) sp.set("maxMoq", params.maxMoq);
  if (params.inStock === "true") sp.set("inStock", "true");
  if (params.negotiable === "true") sp.set("negotiable", "true");
  if (params.sampleAvailable === "true") sp.set("sampleAvailable", "true");
  sp.set("page", String(params.page));
  return `/products?${sp.toString()}`;
}

describe("buildPageUrl", () => {
  it("preserves all params when paginating", () => {
    const url = buildPageUrl({
      query: "steel",
      categorySlug: "metals",
      sort: "price_asc",
      minPrice: "100",
      maxPrice: "500",
      minMoq: "10",
      maxMoq: "100",
      inStock: "true",
      negotiable: "true",
      sampleAvailable: "true",
      page: 2,
    });
    expect(url).toContain("q=steel");
    expect(url).toContain("category=metals");
    expect(url).toContain("sort=price_asc");
    expect(url).toContain("minPrice=100");
    expect(url).toContain("maxPrice=500");
    expect(url).toContain("minMoq=10");
    expect(url).toContain("maxMoq=100");
    expect(url).toContain("inStock=true");
    expect(url).toContain("negotiable=true");
    expect(url).toContain("sampleAvailable=true");
    expect(url).toContain("page=2");
  });

  it("omits relevance sort", () => {
    const url = buildPageUrl({
      query: "",
      categorySlug: "",
      sort: "relevance",
      page: 1,
    });
    expect(url).not.toContain("sort=");
  });

  it("includes sort when not relevance", () => {
    const url = buildPageUrl({
      query: "",
      categorySlug: "",
      sort: "newest",
      page: 1,
    });
    expect(url).toContain("sort=newest");
  });

  it("handles empty params", () => {
    const url = buildPageUrl({
      query: "",
      categorySlug: "",
      sort: "relevance",
      page: 1,
    });
    expect(url).toBe("/products?page=1");
  });
});

// ---------------------------------------------------------------------------
// Query trimming
// ---------------------------------------------------------------------------

function trimQuery(query: string | undefined): string {
  return query?.trim() ?? "";
}

describe("trimQuery", () => {
  it("trims whitespace", () => {
    expect(trimQuery("  steel  ")).toBe("steel");
  });

  it("returns empty for undefined", () => {
    expect(trimQuery(undefined)).toBe("");
  });

  it("returns empty for whitespace-only", () => {
    expect(trimQuery("   ")).toBe("");
  });

  it("preserves multi-word queries", () => {
    expect(trimQuery("stainless steel pipe")).toBe("stainless steel pipe");
  });

  it("Preserves punctuation", () => {
    expect(trimQuery("steel (304)")).toBe("steel (304)");
  });
});
