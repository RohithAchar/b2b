import { describe, expect, it } from "vitest";
import { BUY_AGAIN_LIMIT, distinctRecentProductIds } from "../lib/buyer/buy-again";

describe("distinctRecentProductIds (Buy again)", () => {
  it("is empty for an account with no orders", () => {
    expect(distinctRecentProductIds([])).toEqual([]);
  });

  it("keeps newest-first order and lists each product once", () => {
    const items = [
      { product_id: "p3" },
      { product_id: "p1" },
      { product_id: "p3" },
      { product_id: "p2" },
      { product_id: "p1" },
    ];
    expect(distinctRecentProductIds(items)).toEqual(["p3", "p1", "p2"]);
  });

  it("skips deleted products and stops at the limit", () => {
    const items = [{ product_id: null }, ...Array.from({ length: 20 }, (_, i) => ({ product_id: `p${i}` }))];
    const ids = distinctRecentProductIds(items);
    expect(ids).toHaveLength(BUY_AGAIN_LIMIT);
    expect(ids[0]).toBe("p0");
  });
});
