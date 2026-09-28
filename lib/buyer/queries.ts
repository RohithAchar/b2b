import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerPrices } from "@/lib/pricing";
import { fetchCustomerPriceMap, fetchSupplierMap } from "@/lib/storefront";

// ---------------------------------------------------------------------------
// Enquiry history
// ---------------------------------------------------------------------------

export type EnquiryRecord = {
  id: string;
  product_id: string;
  supplier_id: string;
  quantity: number | null;
  message: string | null;
  status: "pending" | "quoted" | "closed";
  created_at: string;
  updated_at: string;
  product: {
    id: string;
    title: string;
    unit: string;
    images: { path: string; sort: number }[];
  } | null;
  supplier: {
    id: string;
    business_name: string;
    city: string;
    state: string;
  } | null;
};

export async function getBuyerEnquiries(
  supabase: SupabaseClient,
  buyerId: string,
  page = 1,
  perPage = 10,
) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, count } = await supabase
    .from("enquiries")
    .select(
      `
        id, product_id, supplier_id, quantity, message, status, created_at, updated_at,
        product:product_id(id, title, unit, images:product_images(path, sort)),
        supplier:supplier_id(id, business_name, city, state)
      `,
      { count: "exact" },
    )
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .range(from, to);

  return {
    enquiries: (data ?? []) as unknown as EnquiryRecord[],
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

// ---------------------------------------------------------------------------
// Saved products
// ---------------------------------------------------------------------------

export type SavedProductRecord = {
  id: string;
  product_id: string;
  created_at: string;
  product: {
    id: string;
    title: string;
    unit: string;
    moq: number;
    negotiable: boolean;
    images: { path: string; sort: number }[];
    supplier: {
      id: string;
      business_name: string;
      city: string;
      state: string;
      logo_path: string | null;
    } | null;
    pricing: CustomerPrices | null;
  };
};

export async function getBuyerSavedProducts(
  supabase: SupabaseClient,
  buyerId: string,
  page = 1,
  perPage = 24,
) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, count } = await supabase
    .from("saved_products")
    .select(
      `
        id, product_id, created_at,
        product:product_id(
          id, title, unit, moq, negotiable, supplier_id,
          images:product_images(path, sort),
          supplier:supplier_id(id, business_name, city, state, logo_path)
        )
      `,
      { count: "exact" },
    )
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as unknown as SavedProductRecord[];
  const productIds = rows
    .map((r) => r.product?.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));
  const supplierIds = rows
    .map((r) => r.product?.supplier?.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));

  const [priceMap, supplierMap] = await Promise.all([
    fetchCustomerPriceMap(supabase, productIds),
    fetchSupplierMap(supabase, supplierIds),
  ]);

  const products = rows.map((r) => {
    if (!r.product) return null;
    const p = r.product;
    return {
      ...p,
      supplier: p.supplier
        ? supplierMap.get(p.supplier.id) ?? p.supplier
        : null,
      pricing: priceMap.get(p.id) ?? null,
    };
  }).filter((p): p is NonNullable<typeof p> => p != null);

  return {
    products,
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

// ---------------------------------------------------------------------------
// Recently viewed
// ---------------------------------------------------------------------------

export type RecentlyViewedRecord = {
  id: string;
  product_id: string;
  last_viewed_at: string;
  product: {
    id: string;
    title: string;
    unit: string;
    moq: number;
    negotiable: boolean;
    images: { path: string; sort: number }[];
    supplier: {
      id: string;
      business_name: string;
      city: string;
      state: string;
      logo_path: string | null;
    } | null;
    pricing: CustomerPrices | null;
  };
};

export async function getBuyerRecentlyViewed(
  supabase: SupabaseClient,
  buyerId: string,
  page = 1,
  perPage = 24,
) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, count } = await supabase
    .from("recently_viewed")
    .select(
      `
        id, product_id, last_viewed_at,
        product:product_id(
          id, title, unit, moq, negotiable, supplier_id,
          images:product_images(path, sort),
          supplier:supplier_id(id, business_name, city, state, logo_path)
        )
      `,
      { count: "exact" },
    )
    .eq("buyer_id", buyerId)
    .order("last_viewed_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as unknown as RecentlyViewedRecord[];
  const productIds = rows
    .map((r) => r.product?.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));
  const supplierIds = rows
    .map((r) => r.product?.supplier?.id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));

  const [priceMap, supplierMap] = await Promise.all([
    fetchCustomerPriceMap(supabase, productIds),
    fetchSupplierMap(supabase, supplierIds),
  ]);

  const products = rows.map((r) => {
    if (!r.product) return null;
    const p = r.product;
    return {
      ...p,
      supplier: p.supplier
        ? supplierMap.get(p.supplier.id) ?? p.supplier
        : null,
      pricing: priceMap.get(p.id) ?? null,
    };
  }).filter((p): p is NonNullable<typeof p> => p != null);

  return {
    products,
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

// ---------------------------------------------------------------------------
// Check if a product is saved by the buyer
// ---------------------------------------------------------------------------

export async function isProductSaved(
  supabase: SupabaseClient,
  buyerId: string,
  productId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("saved_products")
    .select("id")
    .eq("buyer_id", buyerId)
    .eq("product_id", productId)
    .maybeSingle();
  return data != null;
}
