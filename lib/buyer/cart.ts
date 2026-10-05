// Pure cart math: minimum value gate, slab pricing, summary totals.
// Kept dependency-free (no Supabase, no Next.js) so it unit-tests in isolation.
// Prices fed in here must already be customer prices resolved server-side from
// the storefront_prices view — never client-supplied numbers.

import type { CustomerPrices } from "@/lib/pricing";

/** Shared cart-wide minimum subtotal (₹) required to check out. */
export const MIN_CART_VALUE = 2500;

export type CartLinePricing = {
  /** cart_items.id — carried opaquely so controls can update/remove the line. */
  cartItemId: string;
  productId: string;
  variantId: string | null;
  title: string;
  unit: string;
  /** Effective MOQ: variant moq, else base moq. Informational only. */
  moq: number;
  /** Effective stock: variant stock, else base stock. Informational only. */
  stockQty: number;
  quantity: number;
  imagePath: string | null;
};

export type PricedCartLine = CartLinePricing & {
  unitPrice: number;
  lineTotal: number;
};

export type CartSummary = {
  lines: PricedCartLine[];
  /** Total units across lines. */
  itemCount: number;
  subtotal: number;
  meetsMinimum: boolean;
  /** Rupees still needed to reach the minimum. 0 when met. */
  shortfall: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Unit customer price for a line. Variant lines use their flat variant price
 * (slabs are product-level only); base lines use the best slab whose min_qty
 * the quantity reaches, else the base customer price. Null when unpriceable.
 */
export function priceForQuantity(
  pricing: CustomerPrices | null,
  variantId: string | null,
  quantity: number,
): number | null {
  if (!pricing || !Number.isFinite(quantity) || quantity < 1) return null;

  if (variantId) {
    const match = pricing.customer_variant_prices.find((v) => v.id === variantId);
    if (!match || !Number.isFinite(match.customer_price)) return null;
    return match.customer_price;
  }

  let best = pricing.customer_price;
  for (const slab of pricing.customer_price_slabs) {
    if (slab.min_qty <= quantity && slab.price < best) best = slab.price;
  }
  return Number.isFinite(best) ? best : null;
}

/** Price every line and roll up the shared-minimum gate. */
export function summarizeCart(
  lines: CartLinePricing[],
  resolvePrice: (line: CartLinePricing) => number | null,
): CartSummary {
  const priced: PricedCartLine[] = [];
  for (const line of lines) {
    const unitPrice = resolvePrice(line);
    if (unitPrice == null) continue; // unpriceable lines never count
    priced.push({ ...line, unitPrice, lineTotal: roundCurrency(unitPrice * line.quantity) });
  }

  const subtotal = roundCurrency(priced.reduce((sum, l) => sum + l.lineTotal, 0));
  const itemCount = priced.reduce((sum, l) => sum + l.quantity, 0);
  const meetsMinimum = subtotal >= MIN_CART_VALUE;

  return {
    lines: priced,
    itemCount,
    subtotal,
    meetsMinimum,
    shortfall: meetsMinimum ? 0 : roundCurrency(MIN_CART_VALUE - subtotal),
  };
}

export function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
