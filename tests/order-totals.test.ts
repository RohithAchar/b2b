import { describe, expect, it } from "vitest";
import {
  grossItemsTotal,
  latestAcceptedQuotation,
  orderAmount,
} from "../lib/orders/quotation";
import { fetchAllRows } from "../lib/supabase/fetch-all";

describe("order amount helpers", () => {
  it("never subtracts a coupon twice", () => {
    expect(grossItemsTotal(2970, 330)).toBe(3300);
    expect(orderAmount(2970)).toBe(2970);
  });

  it("uses the latest accepted quotation, not a superseded one", () => {
    const quotes = [
      { status: "superseded", version: 1, total: 3100 },
      { status: "accepted", version: 2, total: 3300 },
      { status: "sent", version: 3, total: 3500 },
    ];
    expect(latestAcceptedQuotation(quotes)?.version).toBe(2);
    expect(orderAmount(2970, quotes)).toBe(3300);
  });

  it("accepts Supabase to-one relations serialized as a single object", () => {
    expect(
      orderAmount(2970, { status: "accepted", version: 1, total: 3200 }),
    ).toBe(3200);
  });
});

describe("fetchAllRows", () => {
  it("pages until a short page arrives", async () => {
    const source = Array.from({ length: 2500 }, (_, index) => index);
    const rows = await fetchAllRows<number>(
      "test rows",
      async (from, to) => ({
        data: source.slice(from, to + 1),
        error: null,
      }),
    );
    expect(rows).toHaveLength(2500);
    expect(rows.at(-1)).toBe(2499);
  });

  it("fails loudly instead of returning a truncated analytics set", async () => {
    await expect(
      fetchAllRows<number>(
        "test rows",
        async (from, to) => ({
          data: Array.from({ length: to - from + 1 }, (_, index) => index),
          error: null,
        }),
        { pageSize: 10, maxRows: 20 },
      ),
    ).rejects.toThrow("test rows exceeds 20 rows");
  });

  it("surfaces query errors with context", async () => {
    await expect(
      fetchAllRows<number>("test rows", async () => ({
        data: null,
        error: { message: "permission denied" },
      })),
    ).rejects.toThrow("test rows query failed: permission denied");
  });
});
