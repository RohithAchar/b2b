import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import {
  getCategoryBySlug,
  getCategoryProductCount,
  getFeaturedSuppliers,
  getHomeBanners,
  getHomeCategories,
  getHomeProducts,
  getNavigationCategories,
  getProduct,
  getProducts,
  getRelatedProducts,
  getSourceRegions,
  type ProductListParams,
} from "./storefront";

/**
 * Cookie-less public client for cached catalog reads. `lib/supabase/server.ts`
 * uses `cookies()` which opts every caller out of the Data Cache, so cached
 * wrappers build their own anon client internally. RLS still applies.
 */
function makePublicClient() {
  return createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

type AnyClient = Parameters<typeof getNavigationCategories>[0];

function normalizeProductParams(params: ProductListParams): ProductListParams {
  return {
    query: params.query?.trim() || undefined,
    categorySlug: params.categorySlug?.trim().toLowerCase() || undefined,
    sort: params.sort ?? "relevance",
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minMoq: params.minMoq,
    maxMoq: params.maxMoq,
    inStock: params.inStock,
    negotiable: params.negotiable,
    sampleAvailable: params.sampleAvailable,
    page: params.page ?? 1,
    perPage: params.perPage ?? 24,
    // imageProductIds intentionally excluded from the stable key helper below —
    // callers bypass the cache when it is present (unique per upload).
    imageProductIds: params.imageProductIds,
  };
}

function stableParamsKey(params: ProductListParams): string {
  const n = normalizeProductParams(params);
  const { imageProductIds: _omit, ...rest } = n;
  void _omit;
  return JSON.stringify(rest);
}

export const getCachedNavigationCategories = unstable_cache(
  async () => getNavigationCategories(makePublicClient() as unknown as AnyClient),
  ["nav-categories"],
  { revalidate: 3600, tags: ["categories", "nav"] },
);

export const getCachedHomeCategories = unstable_cache(
  async () => getHomeCategories(makePublicClient() as unknown as AnyClient),
  ["home-categories"],
  { revalidate: 600, tags: ["categories", "home", "products"] },
);

export const getCachedHomeProducts = unstable_cache(
  async () => getHomeProducts(makePublicClient() as unknown as AnyClient),
  ["home-products"],
  { revalidate: 120, tags: ["products", "prices", "home"] },
);

export const getCachedHomeBanners = unstable_cache(
  async () => getHomeBanners(makePublicClient() as unknown as AnyClient),
  ["home-banners"],
  { revalidate: 300, tags: ["banners", "home"] },
);

export const getCachedSourceRegions = unstable_cache(
  async () => getSourceRegions(makePublicClient() as unknown as AnyClient),
  ["source-regions"],
  { revalidate: 3600, tags: ["suppliers", "home"] },
);

export const getCachedFeaturedSuppliers = unstable_cache(
  async () => getFeaturedSuppliers(makePublicClient() as unknown as AnyClient),
  ["featured-suppliers"],
  { revalidate: 600, tags: ["suppliers", "home"] },
);

export const getCachedProduct = unstable_cache(
  async (productId: string) =>
    getProduct(makePublicClient() as unknown as AnyClient, productId),
  ["product"],
  { revalidate: 180, tags: ["products"] },
);

export const getCachedRelatedProducts = unstable_cache(
  async (categoryId: string, excludeId: string) =>
    getRelatedProducts(makePublicClient() as unknown as AnyClient, categoryId, excludeId),
  ["related"],
  { revalidate: 120, tags: ["products"] },
);

export const getCachedCategoryBySlug = unstable_cache(
  async (slug: string) =>
    getCategoryBySlug(makePublicClient() as unknown as AnyClient, slug.toLowerCase()),
  ["category"],
  { revalidate: 600, tags: ["categories"] },
);

export const getCachedCategoryProductCount = unstable_cache(
  async (categoryId: string) =>
    getCategoryProductCount(makePublicClient() as unknown as AnyClient, categoryId),
  ["category-count"],
  { revalidate: 300, tags: ["categories", "products"] },
);

async function getProductsUncached(params: ProductListParams) {
  return getProducts(makePublicClient() as unknown as AnyClient, normalizeProductParams(params));
}

/**
 * Cached product listing. Image-search candidate pools (`imageProductIds`) are
 * unique per upload so they bypass the cache to avoid an unbounded key space.
 * Deep pages (>7, beyond the rendered pagination window) also bypass.
 */
export async function getCachedProducts(params: ProductListParams) {
  const normalized = normalizeProductParams(params);
  if (normalized.imageProductIds?.length) {
    return getProductsUncached(normalized);
  }
  if ((normalized.page ?? 1) > 7) {
    return getProductsUncached(normalized);
  }
  const key = stableParamsKey(normalized);
  const tags = ["products", "prices"];
  if (normalized.categorySlug) tags.push(`category:${normalized.categorySlug}`);
  const cached = unstable_cache(
    async () => getProductsUncached(normalized),
    ["products", key],
    { revalidate: 60, tags },
  );
  return cached();
}
