import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerPrices } from "@/lib/pricing";

type StorefrontSupplier = {
  id: string;
  business_name: string;
  city: string;
  state: string;
  logo_path: string | null;
};

export async function fetchSupplierMap(
  supabase: SupabaseClient,
  ids: (string | null | undefined)[],
): Promise<Map<string, StorefrontSupplier>> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))] as string[];
  const map = new Map<string, StorefrontSupplier>();
  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("storefront_suppliers")
    .select("id, business_name, city, state, logo_path")
    .in("id", unique);

  for (const s of (data ?? []) as StorefrontSupplier[]) {
    map.set(s.id, s);
  }

  return map;
}

type StorefrontPriceRow = {
  product_id: string;
  customer_price: number;
  customer_sample_price: number | null;
  customer_price_slabs: CustomerPrices["customer_price_slabs"];
  customer_variant_prices: CustomerPrices["customer_variant_prices"];
};

/**
 * Base prices and supplier margins are private, so customer prices come from the
 * storefront_prices view (which computes them) rather than from products. The
 * view filters on the same approved / not-hidden condition as the product
 * queries, so every product the storefront can see has a pricing row.
 */
export async function fetchCustomerPriceMap(
  supabase: SupabaseClient,
  ids: (string | null | undefined)[],
): Promise<Map<string, CustomerPrices>> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))] as string[];
  const map = new Map<string, CustomerPrices>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("storefront_prices")
    .select(
      "product_id, customer_price, customer_sample_price, customer_price_slabs, customer_variant_prices",
    )
    .in("product_id", unique);

  if (error) {
    // Degrade to "Price on request" rather than failing the page, but make the
    // cause visible: a missing storefront_prices view looks like empty data.
    console.error(
      "fetchCustomerPriceMap failed:",
      error.code,
      error.message,
    );
  }

  for (const row of (data ?? []) as StorefrontPriceRow[]) {
    map.set(row.product_id, {
      customer_price: Number(row.customer_price),
      customer_sample_price:
        row.customer_sample_price == null ? null : Number(row.customer_sample_price),
      customer_price_slabs: row.customer_price_slabs ?? [],
      customer_variant_prices: row.customer_variant_prices ?? [],
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Storefront navigation categories (header rail)
// ---------------------------------------------------------------------------

export async function getNavigationCategories(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order")
    .order("name");
  return (data ?? []) as { id: string; name: string; slug: string }[];
}

// ---------------------------------------------------------------------------
// Homepage data (split so sections can stream independently)
// ---------------------------------------------------------------------------

export async function getHomeCategories(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, image_path")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order")
    .order("name");

  const categories = (data ?? []) as { id: string; name: string; slug: string; image_path: string | null }[];

  // Product counts per category (approved, subcategories rolled into parents).
  const counts = await getCategoryProductCounts(
    supabase,
    categories.map((c) => c.id),
  );

  return categories.map((c) => ({
    ...c,
    product_count: counts[c.id] ?? 0,
  }));
}

export async function getHomeProducts(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("products")
    .select(
      "id, title, unit, moq, negotiable, created_at, supplier_id, category:category_id(name, slug), images:product_images(path, sort)",
    )
    .eq("status", "approved")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(12);

  const products = data ?? [];
  const ids = products.map((p) => p.id as string);
  const [supplierMap, priceMap] = await Promise.all([
    fetchSupplierMap(
      supabase,
      products.map((p) => p.supplier_id as string),
    ),
    fetchCustomerPriceMap(supabase, ids),
  ]);

  return products.map((p) => ({
    ...p,
    supplier: supplierMap.get(p.supplier_id as string) ?? null,
    pricing: priceMap.get(p.id as string) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Product listing with search + filter + sort + pagination
// ---------------------------------------------------------------------------

export type ProductSort =
  | "relevance"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "moq_asc";

export type ProductListParams = {
  query?: string;
  categorySlug?: string;
  sort?: ProductSort;
  minPrice?: number;
  maxPrice?: number;
  minMoq?: number;
  maxMoq?: number;
  inStock?: boolean;
  negotiable?: boolean;
  sampleAvailable?: boolean;
  page?: number;
  perPage?: number;
  /**
   * Search-by-image candidate products, most visually similar first. Constrains
   * the listing to this set — it is a candidate pool, never a bypass of the
   * other filters or the approved / not-hidden condition below. The `relevance`
   * sort means "in the order given" rather than "newest".
   */
  imageProductIds?: string[];
};

export async function getProducts(supabase: SupabaseClient, params: ProductListParams) {
  const {
    query,
    categorySlug,
    sort = "relevance",
    minPrice,
    maxPrice,
    minMoq,
    maxMoq,
    inStock,
    negotiable,
    sampleAvailable,
    page = 1,
    perPage = 24,
    imageProductIds,
  } = params;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Image search ranks by visual distance, so when it is active "relevance"
  // means "in the order the caller supplied" rather than "newest first".
  const similarityRank = imageProductIds
    ? new Map(imageProductIds.map((id, index) => [id, index]))
    : null;
  const rankedIds = imageProductIds?.length ? [...imageProductIds] : null;

  // Build the base filtered query (without sorting/pagination yet).
  let qb = supabase
    .from("products")
    .select(
      "id, title, unit, moq, negotiable, supplier_id, category:category_id(name, slug), images:product_images(path, sort)",
      { count: "exact" },
    )
    .eq("status", "approved")
    .eq("is_hidden", false);

  // An .eq("id") per candidate would be an OR chain; .in() is a single
  // membership test, so the candidate set can only ever narrow the listing.
  if (similarityRank) {
    qb = qb.in("id", rankedIds!);
  }

  // Trim and skip empty queries — textSearch with "" matches everything but
  // wastes a GIN index scan and can produce surprising results.
  const trimmedQuery = query?.trim() ?? "";
  if (trimmedQuery) {
    qb = qb.textSearch("title", trimmedQuery, { type: "websearch" });
  }

  if (categorySlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (cat) {
      qb = qb.eq("category_id", cat.id);
    }
  }

  if (minMoq != null) {
    qb = qb.gte("moq", minMoq);
  }
  if (maxMoq != null) {
    qb = qb.lte("moq", maxMoq);
  }
  if (inStock) {
    qb = qb.gt("stock_qty", 0);
  }
  if (negotiable) {
    qb = qb.eq("negotiable", true);
  }
  if (sampleAvailable) {
    qb = qb.eq("sample_available", true);
  }

  // Price filtering and sorting require the storefront_prices view.
  // We handle price sorts with a 3-query approach:
  //   1. Get matching product IDs (with all filters applied)
  //   2. Get prices for those IDs, ordered by customer_price
  //   3. Fetch full product data for the paginated IDs
  const needsPriceSort = sort === "price_asc" || sort === "price_desc";
  const needsPriceFilter = minPrice != null || maxPrice != null;

  if (needsPriceSort || needsPriceFilter) {
    // Step 1: Get matching product IDs (no pagination yet, bounded so a
    // broad filter cannot pull the whole table into memory / URL).
    const { data: idRows } = await qb.order("id").limit(1000);

    const allIds = (idRows ?? []).map((r) => r.id as string);

    if (allIds.length === 0) {
      return { products: [], total: 0, page, perPage, totalPages: 0 };
    }

    // Step 2: Get prices for those IDs in bounded chunks — a single
    // `.in()` with 1k+ IDs risks URL length / 414 and slow plans.
    const priceById = new Map<string, number>();
    for (let i = 0; i < allIds.length; i += 200) {
      const chunk = allIds.slice(i, i + 200);
      let priceQb = supabase
        .from("storefront_prices")
        .select("product_id, customer_price")
        .in("product_id", chunk);

      if (minPrice != null) {
        priceQb = priceQb.gte("customer_price", minPrice);
      }
      if (maxPrice != null) {
        priceQb = priceQb.lte("customer_price", maxPrice);
      }

      const { data: priceRows } = await priceQb;
      for (const r of (priceRows ?? []) as { product_id: string; customer_price: number }[]) {
        priceById.set(r.product_id as string, Number(r.customer_price));
      }
    }
    const priceMap = priceById;

    // Filter IDs by price range.
    const filteredIds = allIds.filter((id) => {
      const price = priceMap.get(id);
      if (price == null) return false;
      if (minPrice != null && price < minPrice) return false;
      if (maxPrice != null && price > maxPrice) return false;
      return true;
    });

    // Sort by price if needed.
    if (needsPriceSort) {
      const ascending = sort === "price_asc";
      filteredIds.sort((a, b) => {
        const pa = priceMap.get(a) ?? 0;
        const pb = priceMap.get(b) ?? 0;
        return ascending ? pa - pb : pb - pa;
      });
    } else if (similarityRank) {
      // Price was only a filter here, so restore visual-similarity order —
      // the .order("id") above would otherwise have reshuffled the candidates.
      filteredIds.sort((a, b) => (similarityRank.get(a) ?? 0) - (similarityRank.get(b) ?? 0));
    }

    const total = filteredIds.length;
    const totalPages = Math.ceil(total / perPage);
    const pageIds = filteredIds.slice(from, to + 1);

    if (pageIds.length === 0) {
      return { products: [], total, page, perPage, totalPages };
    }

    // Step 3: Fetch full product data for the paginated IDs.
    const { data: rows } = await supabase
      .from("products")
      .select(
        "id, title, unit, moq, negotiable, supplier_id, category:category_id(name, slug), images:product_images(path, sort)",
      )
      .eq("status", "approved")
      .eq("is_hidden", false)
      .in("id", pageIds);

    // Maintain the price-sorted order.
    const rowMap = new Map((rows ?? []).map((r) => [r.id as string, r]));
    const orderedRows = pageIds
      .map((id) => rowMap.get(id))
      .filter((r): r is NonNullable<typeof r> => r != null);

    const [supplierMap, fullPriceMap] = await Promise.all([
      fetchSupplierMap(
        supabase,
        orderedRows.map((p) => p.supplier_id as string),
      ),
      fetchCustomerPriceMap(
        supabase,
        orderedRows.map((p) => p.id as string),
      ),
    ]);

    return {
      products: orderedRows.map((p) => ({
        ...p,
        supplier: supplierMap.get(p.supplier_id as string) ?? null,
        pricing: fullPriceMap.get(p.id as string) ?? null,
      })),
      total,
      page,
      perPage,
      totalPages,
    };
  }

  // Image search with the default sort: the candidate pool is already small and
  // bounded, and its order is a visual ranking PostgREST cannot express, so page
  // and order are applied here instead of in the query. Mirrors the three-step
  // approach the price path already takes.
  if (similarityRank) {
    const { data, count } = await qb.order("id");
    const rows = data ?? [];

    const ranked = rows
      .filter((row) => similarityRank.has(row.id as string))
      .sort(
        (a, b) =>
          (similarityRank.get(a.id as string) ?? 0) - (similarityRank.get(b.id as string) ?? 0),
      );

    const pageRows = ranked.slice(from, to + 1);
    const [supplierMap, priceMap] = await Promise.all([
      fetchSupplierMap(
        supabase,
        pageRows.map((p) => p.supplier_id as string),
      ),
      fetchCustomerPriceMap(
        supabase,
        pageRows.map((p) => p.id as string),
      ),
    ]);

    return {
      products: pageRows.map((p) => ({
        ...p,
        supplier: supplierMap.get(p.supplier_id as string) ?? null,
        pricing: priceMap.get(p.id as string) ?? null,
      })),
      total: count ?? ranked.length,
      page,
      perPage,
      totalPages: Math.ceil((count ?? ranked.length) / perPage),
    };
  }

  // Non-price sorts: single query with server-side ordering.
  if (sort === "newest") {
    qb = qb.order("created_at", { ascending: false });
  } else if (sort === "moq_asc") {
    qb = qb.order("moq", { ascending: true });
  } else {
    // relevance / default
    qb = qb.order("created_at", { ascending: false });
  }

  qb = qb.range(from, to);

  const { data, count } = await qb;

  const rows = data ?? [];
  const [supplierMap, priceMap] = await Promise.all([
    fetchSupplierMap(
      supabase,
      rows.map((p) => p.supplier_id as string),
    ),
    fetchCustomerPriceMap(
      supabase,
      rows.map((p) => p.id as string),
    ),
  ]);

  return {
    products: rows.map((p) => ({
      ...p,
      supplier: supplierMap.get(p.supplier_id as string) ?? null,
      pricing: priceMap.get(p.id as string) ?? null,
    })),
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

// ---------------------------------------------------------------------------
// Single product detail
// ---------------------------------------------------------------------------

export async function getProduct(supabase: SupabaseClient, productId: string) {
  const { data } = await supabase
    .from("products")
    .select(
      `
        id, title, description, brand, seller_sku, hsn_code, unit,
        moq, stock_qty, negotiable,
        sample_available, lead_time_days, gst_rate,
        attributes, certifications, packaging_details, warranty_return,
        youtube_url, youtube_id, created_at, supplier_id,
        seo_title, seo_description, seo_image_path,
        category:category_id(id, name, slug),
        images:product_images(id, path, sort, alt),
        variants:product_variants(id, label, attrs, seller_sku, moq, stock_qty, sort)
      `,
    )
    .eq("id", productId)
    .eq("status", "approved")
    .eq("is_hidden", false)
    .maybeSingle();

  if (!data) return null;

  const [supplierMap, priceMap] = await Promise.all([
    fetchSupplierMap(supabase, [data.supplier_id as string]),
    fetchCustomerPriceMap(supabase, [data.id as string]),
  ]);

  return {
    ...data,
    supplier: supplierMap.get(data.supplier_id as string) ?? null,
    pricing: priceMap.get(data.id as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Category by slug
// ---------------------------------------------------------------------------

export async function getCategoryBySlug(supabase: SupabaseClient, slug: string) {
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, image_path, parent_id")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!category) return null;

  const { data: subcategories } = await supabase
    .from("categories")
    .select("id, name, slug, image_path")
    .eq("parent_id", category.id)
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  return { ...category, subcategories: subcategories ?? [] };
}

// ---------------------------------------------------------------------------
// Mega-menu categories: top-level parents with images + counts plus their
// subcategories in two queries (avoids N+1 getCategoryBySlug calls).
// ---------------------------------------------------------------------------

export type MegaMenuCategoryData = {
  id: string;
  name: string;
  slug: string;
  image_path: string | null;
  product_count: number;
  subcategories: {
    id: string;
    name: string;
    slug: string;
    image_path: string | null;
  }[];
};

export async function getMegaMenuCategories(
  supabase: SupabaseClient,
): Promise<MegaMenuCategoryData[]> {
  const { data: parents } = await supabase
    .from("categories")
    .select("id, name, slug, image_path")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order")
    .order("name");

  const parentRows =
    (parents ?? []) as {
      id: string;
      name: string;
      slug: string;
      image_path: string | null;
    }[];
  if (parentRows.length === 0) return [];

  const parentIds = parentRows.map((p) => p.id);
  const [{ data: subs }, counts] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, image_path, parent_id")
      .in("parent_id", parentIds)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    getCategoryProductCounts(supabase, parentIds),
  ]);

  const subsByParent = new Map<string, MegaMenuCategoryData["subcategories"]>();
  for (const s of (subs ?? []) as {
    id: string;
    name: string;
    slug: string;
    image_path: string | null;
    parent_id: string;
  }[]) {
    const list = subsByParent.get(s.parent_id) ?? [];
    list.push({ id: s.id, name: s.name, slug: s.slug, image_path: s.image_path });
    subsByParent.set(s.parent_id, list);
  }

  return parentRows.map((p) => ({
    ...p,
    product_count: counts[p.id] ?? 0,
    subcategories: subsByParent.get(p.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Category product counts (used by homepage)
// ---------------------------------------------------------------------------

export async function getCategoryProductCounts(
  supabase: SupabaseClient,
  categoryIds: string[],
): Promise<Record<string, number>> {
  if (categoryIds.length === 0) return {};

  const { data } = await supabase
    .from("category_product_counts")
    .select("category_id, product_count")
    .in("category_id", categoryIds);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { category_id: string; product_count: number }[]) {
    counts[row.category_id] = row.product_count;
  }
  return counts;
}

export async function getCategoryProductCount(
  supabase: SupabaseClient,
  categoryId: string,
): Promise<number> {
  const { data } = await supabase
    .from("category_product_counts")
    .select("product_count")
    .eq("category_id", categoryId)
    .maybeSingle();
  return (data as { product_count?: number } | null)?.product_count ?? 0;
}

// ---------------------------------------------------------------------------
// Homepage banners (hero carousel + promo strip)
// ---------------------------------------------------------------------------

export async function getHomeBanners(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("home_banners")
    .select("id, slot, title, subtitle, link_url, image_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Source From India: real supplier locations grouped by state
// ---------------------------------------------------------------------------

export async function getSourceRegions(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("storefront_suppliers")
    .select("city, state")
    .limit(200);

  const regions: { state: string; cities: string[] }[] = [];
  const stateMap = new Map<string, Set<string>>();
  for (const row of (data ?? []) as { city: string | null; state: string | null }[]) {
    if (!row.state || !row.city) continue;
    if (!stateMap.has(row.state)) stateMap.set(row.state, new Set());
    stateMap.get(row.state)!.add(row.city);
  }
  for (const [state, cities] of stateMap) {
    regions.push({ state, cities: [...cities].slice(0, 6) });
  }
  regions.sort((a, b) => b.cities.length - a.cities.length);
  return regions.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Featured suppliers (for homepage)
// ---------------------------------------------------------------------------

export async function getFeaturedSuppliers(supabase: SupabaseClient) {
  const { data: suppliers } = await supabase
    .from("storefront_suppliers")
    .select("id, business_name, city, state, logo_path")
    .order("created_at", { ascending: false })
    .limit(6);

  if (!suppliers || suppliers.length === 0) return [];

  // Get up to 3 product images per supplier from the projection view.
  const supplierIds = suppliers.map((s) => s.id as string);
  const { data: featured } = await supabase
    .from("supplier_featured_images")
    .select("supplier_id, image_path")
    .in("supplier_id", supplierIds)
    .limit(18);

  const imagesBySupplier: Record<string, string[]> = {};
  for (const row of (featured ?? []) as {
    supplier_id: string;
    image_path: string;
  }[]) {
    if ((imagesBySupplier[row.supplier_id]?.length ?? 0) < 3) {
      (imagesBySupplier[row.supplier_id] ??= []).push(row.image_path);
    }
  }

  return suppliers.map((s) => ({
    ...s,
    product_images: imagesBySupplier[s.id as string] ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Related products (same category)
// ---------------------------------------------------------------------------

export async function getRelatedProducts(
  supabase: SupabaseClient,
  categoryId: string,
  excludeProductId: string,
) {
  const { data } = await supabase
    .from("products")
    .select(
      "id, title, unit, moq, supplier_id, images:product_images(path, sort)",
    )
    .eq("status", "approved")
    .eq("is_hidden", false)
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = data ?? [];
  const [supplierMap, priceMap] = await Promise.all([
    fetchSupplierMap(
      supabase,
      rows.map((p) => p.supplier_id as string),
    ),
    fetchCustomerPriceMap(
      supabase,
      rows.map((p) => p.id as string),
    ),
  ]);

  return rows.map((p) => ({
    ...p,
    supplier: supplierMap.get(p.supplier_id as string) ?? null,
    pricing: priceMap.get(p.id as string) ?? null,
  }));
}