import { describe, expect, it } from "vitest";
import { gstForLines } from "../lib/buyer/cart";

describe("gstForLines (purchase page GST)", () => {
  it("adds each line's own GST rate", () => {
    // ₹1000 at 18% + ₹500 at 5% = 180 + 25
    expect(
      gstForLines([
        { lineTotal: 1000, gstRate: 18 },
        { lineTotal: 500, gstRate: 5 },
      ]),
    ).toBe(205);
  });

  it("treats a missing or zero rate as no GST", () => {
    expect(gstForLines([{ lineTotal: 999, gstRate: null }, { lineTotal: 100 }, { lineTotal: 50, gstRate: 0 }])).toBe(0);
  });

  it("charges GST on the discounted value when a coupon applies", () => {
    // ₹2000 at 18% = 360; a 10% coupon (pay 1800 of 2000) → 324
    expect(gstForLines([{ lineTotal: 2000, gstRate: 18 }], 1800 / 2000)).toBe(324);
  });

  it("rounds to the paisa", () => {
    // 333.33 × 12% = 39.9996 → 40.00
    expect(gstForLines([{ lineTotal: 333.33, gstRate: 12 }])).toBe(40);
  });
});
