// Pure helpers for deriving customer-facing prices from a supplier's base price.
// Kept dependency-free so they can be unit-tested without a Supabase client.
//
// The storefront does NOT use these: it reads already-computed prices from the
// storefront_prices view. These are for the supplier and admin dashboards, which
// see the base price and need to show buyers what they will actually pay.

/** Mirrors companies_margin_pct_check. */
export const MAX_MARGIN_PCT = 100;

export type CustomerPriceSlab = { min_qty: number; price: number };

/** One storefront_prices row, as consumed by the storefront components. */
export type CustomerPrices = {
  customer_price: number;
  customer_sample_price: number | null;
  customer_price_slabs: CustomerPriceSlab[];
  customer_variant_prices: { id: string; customer_price: number }[];
};

/** One supplier_prices row: base prices, visible only to the owner and admins. */
export type BasePrices = {
  price_per_unit: number;
  price_slabs: CustomerPriceSlab[];
  sample_price: number | null;
  variants: { id: string; label: string; price: number }[];
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampMargin(marginPct: number): number {
  if (!Number.isFinite(marginPct) || marginPct <= 0) return 0;
  return Math.min(marginPct, MAX_MARGIN_PCT);
}

/**
 * Base price plus the supplier's margin, rounded to paise. The rounding matters:
 * 100 * 1.1 is 110.00000000000001 in binary floating point.
 */
export function customerPrice(base: number, marginPct: number): number {
  const margin = clampMargin(Number(marginPct));
  if (!Number.isFinite(base) || base <= 0) return 0;
  return roundCurrency(base * (1 + margin / 100));
}

export function customerPriceOrNull(
  base: number | null | undefined,
  marginPct: number,
): number | null {
  if (base == null) return null;
  return customerPrice(Number(base), marginPct);
}

/** Applies the margin to a product's base price and its per-variant prices. */
export function customerProductPricing(
  base: { price_per_unit: number },
  variants: readonly { price: number }[],
  marginPct: number,
): { customer_price: number; variant_prices: number[] } {
  return {
    customer_price: customerPrice(Number(base.price_per_unit), marginPct),
    variant_prices: variants.map((v) => customerPrice(Number(v.price), marginPct)),
  };
}
