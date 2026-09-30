import { describe, expect, it } from "vitest";
import {
  buildPageUrl,
  parseBoolean,
  parseImageQueryId,
  parseNumber,
  parseSort,
  trimQuery,
  type ProductSort,
} from "../lib/storefront-query";

// These tests exercise the helpers the /products page and filter bar actually
// use (lib/storefront-query.ts). They previously duplicated private copies of
// these functions inside the test file, which meant the page could drift while
// the suite still passed.



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

  it("preserves punctuation", () => {
    expect(trimQuery("steel (304)")).toBe("steel (304)");
  });
});

describe("parseImageQueryId", () => {
  const valid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  it("accepts a uuid", () => {
    expect(parseImageQueryId(valid)).toBe(valid);
  });

  it("lowercases and trims", () => {
    expect(parseImageQueryId(`  ${valid.toUpperCase()}  `)).toBe(valid);
  });

  it("rejects non-uuid values", () => {
    // A malformed ?img= would otherwise be forwarded to the ranking RPC, which
    // would raise a uuid parse error and fail the whole page.
    expect(parseImageQueryId("not-a-uuid")).toBeNull();
    expect(parseImageQueryId("'; drop table products; --")).toBeNull();
    expect(parseImageQueryId("12345")).toBeNull();
  });

  it("rejects empty values", () => {
    expect(parseImageQueryId(undefined)).toBeNull();
    expect(parseImageQueryId("")).toBeNull();
    expect(parseImageQueryId("   ")).toBeNull();
  });
});

describe("buildPageUrl", () => {
  const base = {
    query: "",
    categorySlug: "",
    sort: "relevance" as ProductSort,
    page: 1,
  };

  it("preserves all text-search params when paginating", () => {
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
    expect(buildPageUrl({ ...base, sort: "relevance" })).not.toContain("sort=");
  });

  it("includes sort when not relevance", () => {
    expect(buildPageUrl({ ...base, sort: "newest" })).toContain("sort=newest");
  });

  it("handles empty params", () => {
    expect(buildPageUrl(base)).toBe("/products?page=1");
  });

  it("carries the image query id instead of q", () => {
    const url = buildPageUrl({
      ...base,
      query: "steel",
      imageQueryId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      page: 3,
    });
    expect(url).toContain("img=3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    // Ranking is visual, so a leftover text term must not ride along.
    expect(url).not.toContain("q=");
    expect(url).toContain("page=3");
  });

  it("drops sort in image mode", () => {
    const url = buildPageUrl({
      ...base,
      sort: "price_desc",
      imageQueryId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });
    expect(url).not.toContain("sort=");
  });

  it("keeps filters alongside the image query id", () => {
    const url = buildPageUrl({
      ...base,
      categorySlug: "metals",
      inStock: "true",
      imageQueryId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });
    expect(url).toContain("img=3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(url).toContain("category=metals");
    expect(url).toContain("inStock=true");
  });
});
