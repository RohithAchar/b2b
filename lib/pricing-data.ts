// Server-side pricing lookups for the supplier and admin dashboards.
//
// Base prices come from the supplier_prices view (owner / admin only) and the
// margin from companies. The storefront does not use this: it reads the
// pre-computed storefront_prices view instead. Pure helpers live in lib/pricing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { customerPrice, customerPriceOrNull, type BasePrices } from "@/lib/pricing";

export type CustomerPricing = {
  customer_price: number;
  customer_sample_price: number | null;
  /** Keyed by product_variants.id. */
  variant_prices: Map<string, number>;
};

type SupplierPriceRow = {
  product_id: string;
  price_per_unit: number;
  sample_price: number | null;
  variants: { id: string; label: string; price: number }[];
};

/**
 * Resolves what buyers pay for the given products.
 *
 * `marginPct` is per product because an admin list spans several suppliers: read
 * it with the `supplier:supplier_id(margin_pct)` embed (admins) or pass the
 * supplier's own companies.margin_pct (supplier dashboards).
 */
export async function fetchCustomerPricing(
  supabase: SupabaseClient,
  products: readonly { id: string; margin_pct: number | null }[],
): Promise<Map<string, CustomerPricing>> {
  const result = new Map<string, CustomerPricing>();
  if (products.length === 0) return result;

  const ids = products.map((p) => p.id);
  const marginById = new Map(products.map((p) => [p.id, Number(p.margin_pct ?? 0)]));

  const { data } = await supabase
    .from("supplier_prices")
    .select("product_id, price_per_unit, sample_price, variants")
    .in("product_id", ids);

  for (const row of (data ?? []) as SupplierPriceRow[]) {
    const marginPct = marginById.get(row.product_id) ?? 0;
    const variants: BasePrices["variants"] = row.variants ?? [];
    result.set(row.product_id, {
      customer_price: customerPrice(Number(row.price_per_unit), marginPct),
      customer_sample_price: customerPriceOrNull(row.sample_price, marginPct),
      variant_prices: new Map(
        variants.map((v) => [v.id, customerPrice(Number(v.price), marginPct)]),
      ),
    });
  }

  return result;
}
