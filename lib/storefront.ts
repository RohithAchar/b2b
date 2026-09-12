import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Homepage data
// ---------------------------------------------------------------------------

export async function getHomepageData(supabase: SupabaseClient) {
  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, slug, image_path")
      .eq("is_active", true)
      .is("parent_id", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("products")
      .select(
        "id, title, price_per_unit, unit, moq, created_at, category:category_id(name, slug), supplier:supplier_id(id, business_name, city, state, logo_path), images:product_images(path, sort)",
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const categories = categoriesResult.data ?? [];
  const products = productsResult.data ?? [];

  // Product counts per category (approved, subcategories rolled into parents).
  const categoryIds = categories.map((c) => c.id);
  const counts = await getCategoryProductCounts(supabase, categoryIds);

  return {
    categories: categories.map((c) => ({
      ...c,
      product_count: counts[c.id] ?? 0,
    })),
    products,
  };
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
      "id, title, price_per_unit, unit, moq, category:category_id(name, slug), supplier:supplier_id(id, business_name, city, state), images:product_images(path, sort)",
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

  const { data, count, error } = await qb;

  return {
    products: data ?? [],
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
  const { data, error } = await supabase
    .from("products")
    .select(
      `
        id, title, description, brand, seller_sku, hsn_code, unit,
        price_per_unit, moq, stock_qty, price_slabs, negotiable,
        sample_available, sample_price, lead_time_days, gst_rate,
        attributes, certifications, packaging_details, warranty_return,
        youtube_url, youtube_id, created_at,
        category:category_id(id, name, slug),
        supplier:supplier_id(id, business_name, city, state, logo_path),
        images:product_images(id, path, sort, alt),
        variants:product_variants(id, label, attrs, seller_sku, price, moq, stock_qty, sort)
      `,
    )
    .eq("id", productId)
    .eq("status", "approved")
    .maybeSingle();

  return data;
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

  // Subcategories belonging to the given (parent) categories.
  const { data: subs } = await supabase
    .from("categories")
    .select("id, parent_id")
    .in("parent_id", categoryIds)
    .eq("is_active", true);

  const subIds = (subs ?? []).map((s) => s.id as string);
  const allIds = [...categoryIds, ...subIds];

  // Tally approved products per category_id in a single query.
  const tally: Record<string, number> = {};
  const { data: countRows } = await supabase
    .from("products")
    .select("category_id")
    .in("category_id", allIds)
    .eq("status", "approved");

  for (const row of countRows ?? []) {
    tally[row.category_id as string] = (tally[row.category_id as string] ?? 0) + 1;
  }

  const subToParent = new Map((subs ?? []).map((s) => [s.id as string, s.parent_id as string]));

  const counts: Record<string, number> = {};
  for (const id of categoryIds) counts[id] = tally[id] ?? 0;
  for (const [subId, parentId] of subToParent) {
    counts[parentId] = (counts[parentId] ?? 0) + (tally[subId] ?? 0);
  }

  return counts;
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
// Featured suppliers (for homepage)
// ---------------------------------------------------------------------------

export async function getFeaturedSuppliers(supabase: SupabaseClient) {
  const { data: suppliers } = await supabase
    .from("companies")
    .select("id, business_name, city, state, logo_path")
    .eq("kyb_status", "verified")
    .order("verified_at", { ascending: false })
    .limit(6);

  if (!suppliers || suppliers.length === 0) return [];

  // Get 3 product images per supplier.
  const supplierIds = suppliers.map((s) => s.id);
  const { data: products } = await supabase
    .from("products")
    .select("supplier_id, images:product_images(path, sort)")
    .in("supplier_id", supplierIds)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  const imagesBySupplier: Record<string, string[]> = {};
  for (const p of products ?? []) {
    const sid = p.supplier_id;
    if (!imagesBySupplier[sid]) imagesBySupplier[sid] = [];
    if (imagesBySupplier[sid].length < 3) {
      const imgs = (p.images as { path: string }[]) ?? [];
      for (const img of imgs) {
        if (imagesBySupplier[sid].length < 3) {
          imagesBySupplier[sid].push(img.path);
        }
      }
    }
  }

  return suppliers.map((s) => ({
    ...s,
    product_images: imagesBySupplier[s.id] ?? [],
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
      "id, title, price_per_unit, unit, moq, supplier:supplier_id(id, business_name), images:product_images(path, sort)",
    )
    .eq("status", "approved")
    .eq("category_id", categoryId)
    .neq("id", excludeProductId)
    .order("created_at", { ascending: false })
    .limit(8);

  return data ?? [];
}
