import { describe, expect, it } from "vitest";
import { parseCouponForm } from "../lib/supplier/coupons";
import {
  describeCoupon,
  parseCouponType,
  validateCouponForOrder,
  type CouponRule,
} from "../lib/supplier/coupons";

function coupon(overrides: Partial<CouponRule> = {}): CouponRule {
  return {
    id: "coupon-id",
    code: "TEST10",
    type: "percent",
    is_active: true,
    percent_value: 10,
    max_discount: null,
    flat_value: null,
    min_order_value: 0,
    buy_quantity: null,
    get_quantity: null,
    free_product_id: null,
    loyalty_points: null,
    usage_limit: null,
    used_count: 0,
    expires_at: null,
    ...overrides,
  };
}

describe("parseCouponForm", () => {
  it("accepts a percent coupon with only its own fields submitted", () => {
    // Browsers omit unrendered conditional inputs entirely (null), e.g.
    // flat/buy/get fields when the percent type is selected.
    const formData = new FormData();
    formData.set("code", "festive10");
    formData.set("type", "percent");
    formData.set("percent_value", "10");
    formData.set("min_order_value", "5000");
    const parsed = parseCouponForm(formData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.code).toBe("FESTIVE10");
      expect(parsed.data.percent_value).toBe(10);
      expect(parsed.data.flat_value).toBeUndefined();
    }
  });

  it("rejects a bad code with a readable message", () => {
    const formData = new FormData();
    formData.set("code", "no spaces!");
    formData.set("type", "flat");
    formData.set("flat_value", "500");
    const parsed = parseCouponForm(formData);
    expect(parsed.success).toBe(false);
  });
});

describe("parseCouponType", () => {
  it("accepts known types and rejects the rest", () => {
    expect(parseCouponType("percent")).toBe("percent");
    expect(parseCouponType("loyalty")).toBe("loyalty");
    expect(parseCouponType("bogus")).toBeNull();
    expect(parseCouponType(undefined)).toBeNull();
  });
});

describe("describeCoupon", () => {
  it("describes percent with cap and minimum", () => {
    expect(
      describeCoupon(coupon({ type: "percent", percent_value: 10, max_discount: 9999, min_order_value: 5000 })),
    ).toBe("10% off (up to ₹9,999) on orders above ₹5,000");
  });

  it("describes flat and unconditional variants", () => {
    expect(describeCoupon(coupon({ type: "flat", flat_value: 500, min_order_value: 2500 }))).toBe(
      "₹500 off on orders above ₹2,500",
    );
    expect(describeCoupon(coupon({ type: "percent", percent_value: 50, min_order_value: 0 }))).toBe(
      "50% off on all orders",
    );
  });

  it("describes non-priced types", () => {
    expect(
      describeCoupon(coupon({ type: "buy_x_get_y", buy_quantity: 2, get_quantity: 1, min_order_value: 1000 })),
    ).toBe("Buy 2 get 1 free on orders above ₹1,000");
    expect(describeCoupon(coupon({ type: "free_shipping", min_order_value: 0 }))).toBe(
      "Free shipping on all orders",
    );
    expect(
      describeCoupon(coupon({ type: "freebie", min_order_value: 5000 }), "Sample Pack"),
    ).toBe("Free Sample Pack above ₹5,000");
    expect(describeCoupon(coupon({ type: "freebie", min_order_value: 5000 }))).toBe(
      "Free gift above ₹5,000",
    );
    expect(describeCoupon(coupon({ type: "loyalty", loyalty_points: 100, min_order_value: 0 }))).toBe(
      "Earn 100 loyalty points on all orders",
    );
  });
});

describe("validateCouponForOrder", () => {
  it("rejects inactive, expired, exhausted and below-minimum coupons", () => {
    expect(validateCouponForOrder(coupon({ is_active: false }), 5000).ok).toBe(false);
    expect(
      validateCouponForOrder(coupon({ expires_at: "2026-01-01T00:00:00Z" }), 5000, new Date("2026-10-14T00:00:00Z")).ok,
    ).toBe(false);
    expect(validateCouponForOrder(coupon({ usage_limit: 5, used_count: 5 }), 5000).ok).toBe(false);
    const below = validateCouponForOrder(coupon({ min_order_value: 2500 }), 1000);
    expect(below.ok).toBe(false);
    if (!below.ok) expect(below.reason).toContain("₹2,500");
  });

  it("prices percent with cap and flat clamped to the subtotal", () => {
    expect(validateCouponForOrder(coupon({ percent_value: 10 }), 10000)).toEqual({
      ok: true,
      discount: 1000,
    });
    expect(
      validateCouponForOrder(coupon({ percent_value: 10, max_discount: 500 }), 10000),
    ).toEqual({ ok: true, discount: 500 });
    expect(
      validateCouponForOrder(coupon({ type: "flat", flat_value: 2000, percent_value: null }), 1500),
    ).toEqual({ ok: true, discount: 1500 });
  });

  it("approves non-priced types with zero priced discount", () => {
    expect(validateCouponForOrder(coupon({ type: "free_shipping" }), 5000)).toEqual({
      ok: true,
      discount: 0,
    });
  });
});
