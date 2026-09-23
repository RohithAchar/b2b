import type { SupabaseClient } from "@supabase/supabase-js";

type StorefrontSupplier = {
  id: string;
  business_name: string;
  city: string;
  state: string;
  logo_path: string | null;
};

async function fetchSupplierMap(
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
      "id, title, price_per_unit, unit, moq, negotiable, created_at, supplier_id, category:category_id(name, slug), images:product_images(path, sort)",
    )
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(12);

  const products = data ?? [];
  const supplierMap = await fetchSupplierMap(
    supabase,
    products.map((p) => p.supplier_id as string),
  );

  return products.map((p) => ({
    ...p,
    supplier: supplierMap.get(p.supplier_id as string) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Product listing with search + filter + pagination
// ---------------------------------------------------------------------------

export type ProductListParams = {
  query?: string;
  categorySlug?: string;
  page?: number;
  perPage?: number;
};

export async function getProducts(supabase: SupabaseClient, params: ProductListParams) {
  const { query, categorySlug, page = 1, perPage = 24 } = params;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let qb = supabase
    .from("products")
    .select(
      "id, title, price_per_unit, unit, moq, negotiable, supplier_id, category:category_id(name, slug), images:product_images(path, sort)",
      { count: "exact" },
    )
    .eq("status", "approved");

  if (query) {
    qb = qb.textSearch("title", query, { type: "websearch" });
  }

  if (categorySlug) {
    // First resolve category ID from slug.
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (cat) {
      qb = qb.eq("category_id", cat.id);
    }
  }

  qb = qb.order("created_at", { ascending: false }).range(from, to);

  const { data, count } = await qb;

  const supplierMap = await fetchSupplierMap(
    supabase,
    (data ?? []).map((p) => p.supplier_id as string),
  );

  return {
    products: (data ?? []).map((p) => ({
      ...p,
      supplier: supplierMap.get(p.supplier_id as string) ?? null,
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
        price_per_unit, moq, stock_qty, price_slabs, negotiable,
        sample_available, sample_price, lead_time_days, gst_rate,
        attributes, certifications, packaging_details, warranty_return,
        youtube_url, youtube_id, created_at, supplier_id,
        seo_title, seo_description, seo_image_path,
        category:category_id(id, name, slug),
        images:product_images(id, path, sort, alt),
        variants:product_variants(id, label, attrs, seller_sku, price, moq, stock_qty, sort)
      `,
    )
    .eq("id", productId)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) return null;

  const supplierMap = await fetchSupplierMap(supabase, [data.supplier_id as string]);
  return { ...data, supplier: supplierMap.get(data.supplier_id as string) ?? null };
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
    .limit(500);

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
    .in("supplier_id", supplierIds);

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
      "id, title, price_per_unit, unit, moq, supplier_id, images:product_images(path, sort)",
    )
    .eq("status", "approved")
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = data ?? [];
  const supplierMap = await fetchSupplierMap(
    supabase,
    rows.map((p) => p.supplier_id as string),
  );

  return rows.map((p) => ({
    ...p,
    supplier: supplierMap.get(p.supplier_id as string) ?? null,
  }));
}