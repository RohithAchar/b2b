import { describe, expect, it } from "vitest";
import { encodeImageResultToken } from "../lib/ai/image-result-token";
import {
  buildCatalogueUrl,
  catalogueFiltersKey,
  countCatalogueFilters,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  parseCatalogueFilters,
  parseCatalogueSort,
  type CatalogueFilters,
} from "../lib/catalogue";

const BASE_FILTERS: CatalogueFilters = {
  query: "",
  categorySlug: "",
  sort: "newest",
};

describe("parseCatalogueFilters", () => {
  it("uses newest for a normal listing", () => {
    expect(parseCatalogueFilters({})).toMatchObject(BASE_FILTERS);
  });

  it("defaults image search to relevance", () => {
    const imageToken = encodeImageResultToken([
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(parseCatalogueFilters({ img: imageToken }).sort).toBe("relevance");
  });

  it("ignores a malformed image token", () => {
    expect(parseCatalogueFilters({ img: "not-a-token" })).toMatchObject(BASE_FILTERS);
  });

  it("parses and bounds filter values", () => {
    const parsed = parseCatalogueFilters({
      q: "  cotton fabric  ",
      category: "Textiles",
      sort: "price_asc",
      minPrice: "100",
      maxPrice: "500.5",
      minMoq: "10",
      maxMoq: "50",
      inStock: "true",
      negotiable: "true",
      sampleAvailable: "true",
    });

    expect(parsed).toEqual({
      query: "cotton fabric",
      categorySlug: "textiles",
      sort: "price_asc",
      minPrice: 100,
      maxPrice: 500.5,
      minMoq: 10,
      maxMoq: 50,
      inStock: true,
      negotiable: true,
      sampleAvailable: true,
      imageToken: undefined,
    });
  });

  it("truncates MOQ values to whole units", () => {
    const parsed = parseCatalogueFilters({ minMoq: "10.9", maxMoq: "50.1" });
    expect(parsed.minMoq).toBe(10);
    expect(parsed.maxMoq).toBe(50);
  });

  it("drops invalid numbers and invalid sorts", () => {
    const parsed = parseCatalogueFilters({
      sort: "sideways",
      minPrice: "-1",
      maxMoq: "many",
    });
    expect(parsed.sort).toBe("newest");
    expect(parsed.minPrice).toBeUndefined();
    expect(parsed.maxMoq).toBeUndefined();
  });
});

describe("parseCatalogueSort", () => {
  it("uses relevance for image mode", () => {
    expect(parseCatalogueSort(undefined, true)).toBe("relevance");
  });

  it("keeps explicit valid sorts in image mode", () => {
    expect(parseCatalogueSort("price_desc", true)).toBe("price_desc");
  });

  it("falls back to newest without image mode", () => {
    expect(parseCatalogueSort(undefined)).toBe("newest");
    expect(parseCatalogueSort("unknown")).toBe("newest");
    expect(parseCatalogueSort("relevance")).toBe("newest");
  });
});

describe("buildCatalogueUrl", () => {
  const filters: CatalogueFilters = {
    query: "steel",
    categorySlug: "metals",
    sort: "price_asc",
    minPrice: 100,
    maxPrice: 500,
    minMoq: 10,
    maxMoq: 100,
    inStock: true,
    negotiable: true,
    sampleAvailable: true,
  };

  it("preserves every active filter", () => {
    const url = buildCatalogueUrl("/products", filters);
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
  });

  it("omits the default sort for normal listings", () => {
    expect(buildCatalogueUrl("/products", BASE_FILTERS)).toBe("/products");
    expect(buildCatalogueUrl("/products", { ...BASE_FILTERS, sort: "newest" })).toBe(
      "/products",
    );
  });

  it("omits relevance when image search is active", () => {
    const imageToken = encodeImageResultToken([
      "11111111-1111-4111-8111-111111111111",
    ]);
    const url = buildCatalogueUrl("/", {
      ...BASE_FILTERS,
      sort: "relevance",
      imageToken,
    });
    expect(url).toContain("img=");
    expect(url).not.toContain("sort=");
  });

  it("removes overrides without disturbing the rest", () => {
    const url = buildCatalogueUrl("/", filters, {
      categorySlug: "",
      minPrice: undefined,
      inStock: undefined,
    });
    expect(url).not.toContain("category=");
    expect(url).not.toContain("minPrice=");
    expect(url).not.toContain("inStock=");
    expect(url).toContain("maxPrice=500");
    expect(url).toContain("q=steel");
  });
});

describe("catalogueFiltersKey", () => {
  it("normalizes undefined and false flags to the same key", () => {
    expect(catalogueFiltersKey(BASE_FILTERS)).toBe(
      catalogueFiltersKey({
        query: "",
        categorySlug: "",
        sort: "newest",
        inStock: false,
        negotiable: false,
      }),
    );
  });
});

describe("countCatalogueFilters", () => {
  it("counts only narrowing filters", () => {
    expect(countCatalogueFilters(BASE_FILTERS)).toBe(0);
    expect(
      countCatalogueFilters({
        ...BASE_FILTERS,
        categorySlug: "metals",
        minPrice: 100,
        inStock: true,
      }),
    ).toBe(3);
  });
});

describe("catalogue cursor", () => {
  const cursor = {
    value: 1735689600.123,
    id: "11111111-1111-4111-8111-111111111111",
  };

  it("round-trips a valid cursor", () => {
    const token = encodeCatalogueCursor(cursor);
    expect(decodeCatalogueCursor(token)).toEqual(cursor);
  });

  it("rejects malformed tokens", () => {
    expect(decodeCatalogueCursor("")).toBeNull();
    expect(decodeCatalogueCursor("not-base64")).toBeNull();
    expect(decodeCatalogueCursor(btoa(JSON.stringify({ value: 1 })))).toBeNull();
    expect(
      decodeCatalogueCursor(
        btoa(JSON.stringify({ value: 1, id: "not-a-uuid" })),
      ),
    ).toBeNull();
  });
});
