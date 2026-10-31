import { describe, expect, it } from "vitest";
import { stockLabel } from "../lib/format";

describe("stockLabel", () => {
  it("never reports a product as out of stock", () => {
    expect(stockLabel(0)).toBe("Made to order");
    expect(stockLabel(null)).toBe("Made to order");
    expect(stockLabel(undefined)).toBe("Made to order");
    expect(stockLabel(-5)).toBe("Made to order");
  });

  it("labels tracked stock with Indian digit grouping", () => {
    expect(stockLabel(1)).toBe("1 in stock");
    expect(stockLabel(12000)).toBe("12,000 in stock");
  });
});
