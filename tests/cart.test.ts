import { describe, expect, it } from "vitest";
import {
  MIN_CART_VALUE,
  priceForQuantity,
  summarizeCart,
  type CartLinePricing,
} from "../lib/buyer/cart";
import type { CustomerPrices } from "../lib/pricing";

const pricing: CustomerPrices = {
  customer_price: 100,
  customer_sample_price: null,
  customer_price_slabs: [
    { min_qty: 10, price: 95 },
    { min_qty: 50, price: 90 },
  ],
  customer_variant_prices: [{ id: "v1", customer_price: 120 }],
};

function line(overrides: Partial<CartLinePricing> = {}): CartLinePricing {
  return {
    cartItemId: "c1",
    productId: "p1",
    variantId: null,
    title: "Widget",
    unit: "pcs",
    moq: 5,
    stockQty: 100,
    quantity: 1,
    imagePath: null,
    ...overrides,
  };
}

describe("MIN_CART_VALUE", () => {
  it("is ₹2,500", () => {
    expect(MIN_CART_VALUE).toBe(2500);
  });
});

describe("priceForQuantity", () => {
  it("returns the base price below the first slab", () => {
    expect(priceForQuantity(pricing, null, 9)).toBe(100);
  });

  it("picks the best slab the quantity reaches", () => {
    expect(priceForQuantity(pricing, null, 10)).toBe(95);
    expect(priceForQuantity(pricing, null, 49)).toBe(95);
    expect(priceForQuantity(pricing, null, 50)).toBe(90);
  });

  it("uses the flat variant price regardless of quantity", () => {
    expect(priceForQuantity(pricing, "v1", 1)).toBe(120);
    expect(priceForQuantity(pricing, "v1", 100)).toBe(120);
  });

  it("returns null for an unknown variant", () => {
    expect(priceForQuantity(pricing, "nope", 5)).toBeNull();
  });

  it("returns null without pricing or with bad quantity", () => {
    expect(priceForQuantity(null, null, 5)).toBeNull();
    expect(priceForQuantity(pricing, null, 0)).toBeNull();
  });
});

describe("summarizeCart", () => {
  const resolve = (l: CartLinePricing) =>
    priceForQuantity(pricing, l.variantId, l.quantity);

  it("totals lines and counts units", () => {
    const summary = summarizeCart(
      [line({ quantity: 2 }), line({ productId: "p2", quantity: 3 })],
      resolve,
    );

    expect(summary.subtotal).toBe(500);
    expect(summary.itemCount).toBe(5);
  });

  it("fails the gate below ₹2,500 with the shortfall", () => {
    const summary = summarizeCart([line({ quantity: 20 })], resolve);

    // 20 × 95 (slab) = 1900
    expect(summary.subtotal).toBe(1900);
    expect(summary.meetsMinimum).toBe(false);
    expect(summary.shortfall).toBe(600);
  });

  it("passes the gate at exactly ₹2,500", () => {
    const summary = summarizeCart([line({ quantity: 25 })], () => 100);

    expect(summary.subtotal).toBe(2500);
    expect(summary.meetsMinimum).toBe(true);
    expect(summary.shortfall).toBe(0);
  });

  it("skips unpriceable lines", () => {
    const summary = summarizeCart([line({ quantity: 2 }), line({ productId: "p9", quantity: 5 })], (l) =>
      l.productId === "p9" ? null : resolve(l),
    );

    expect(summary.lines).toHaveLength(1);
    expect(summary.subtotal).toBe(200);
  });

  it("rounds paise without float drift", () => {
    const summary = summarizeCart([line({ quantity: 3 })], () => 33.333);

    expect(summary.subtotal).toBe(100);
  });

  it("is empty-cart safe", () => {
    const summary = summarizeCart([], () => 100);

    expect(summary).toEqual({
      lines: [],
      itemCount: 0,
      subtotal: 0,
      meetsMinimum: false,
      shortfall: MIN_CART_VALUE,
    });
  });
});
