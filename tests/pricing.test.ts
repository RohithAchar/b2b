import { describe, expect, it } from "vitest";
import {
  MAX_MARGIN_PCT,
  customerPrice,
  customerPriceOrNull,
} from "../lib/pricing";
import { marginPctSchema } from "../lib/supplier/kyb";

describe("customerPrice", () => {
  it("leaves the base price untouched at zero margin", () => {
    expect(customerPrice(100, 0)).toBe(100);
  });

  it("adds the margin, so 100 + 10% is 110", () => {
    expect(customerPrice(100, 10)).toBe(110);
  });

  it("rounds to paise instead of leaking binary float noise", () => {
    // 100 * 1.1 is 110.00000000000001 in binary floating point.
    expect(customerPrice(100, 10)).toBe(110);
    expect(customerPrice(0.1, 10)).toBe(0.11);
    expect(customerPrice(19.99, 15)).toBe(22.99);
  });

  it("rounds half up at two decimals", () => {
    expect(customerPrice(10, 5.55)).toBe(10.56);
    expect(customerPrice(33, 3)).toBe(33.99);
  });

  it("accepts a fractional margin percentage", () => {
    expect(customerPrice(200, 12.5)).toBe(225);
  });

  it("caps the margin at the database maximum", () => {
    expect(customerPrice(100, 250)).toBe(
      customerPrice(100, MAX_MARGIN_PCT),
    );
    expect(customerPrice(100, MAX_MARGIN_PCT)).toBe(200);
  });

  it("treats a negative margin as zero instead of discounting", () => {
    expect(customerPrice(100, -20)).toBe(100);
  });

  it("returns 0 for a missing or non-positive base price", () => {
    expect(customerPrice(Number.NaN, 10)).toBe(0);
    expect(customerPrice(0, 10)).toBe(0);
  });
});

describe("customerPriceOrNull", () => {
  it("keeps an absent price absent", () => {
    expect(customerPriceOrNull(null, 10)).toBeNull();
    expect(customerPriceOrNull(undefined, 10)).toBeNull();
  });

  it("applies the margin when a price exists", () => {
    expect(customerPriceOrNull(50, 20)).toBe(60);
  });
});

describe("marginPctSchema", () => {
  it("accepts a plain percentage", () => {
    expect(marginPctSchema.parse("10")).toBe(10);
    expect(marginPctSchema.parse(" 12.5 ")).toBe(12.5);
  });

  it("accepts zero", () => {
    expect(marginPctSchema.parse("0")).toBe(0);
  });

  it("rejects an empty value instead of silently reading it as 0%", () => {
    expect(marginPctSchema.safeParse("").success).toBe(false);
  });

  it("rejects a margin above the database maximum", () => {
    expect(marginPctSchema.safeParse("101").success).toBe(false);
  });

  it("rejects negative and non-numeric margins", () => {
    expect(marginPctSchema.safeParse("-5").success).toBe(false);
    expect(marginPctSchema.safeParse("abc").success).toBe(false);
  });
});
