import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { teamOrderAlertText } = await import("../lib/notifications/team-order-alert");

describe("teamOrderAlertText (WhatsApp alert to the team)", () => {
  it("lists each order with its store and GST-inclusive total, plus who to call", () => {
    const text = teamOrderAlertText({
      buyerName: "Ravi Kumar",
      buyerPhone: "9876543210",
      orders: [
        { reference: "B2B-00042", supplierName: "Shree Traders", total: 2950 },
        { reference: "B2B-00043", supplierName: "Om Packaging", total: 1180.5 },
      ],
    });
    expect(text).toContain("New order");
    expect(text).toContain("B2B-00042");
    expect(text).toContain("Shree Traders");
    expect(text).toContain("₹2,950");
    expect(text).toContain("B2B-00043");
    expect(text).toContain("Ravi Kumar");
    expect(text).toContain("9876543210");
    expect(text).toContain("₹4,130.5"); // grand total across orders (formatRupees style)
  });

  it("never includes the delivery address", () => {
    const text = teamOrderAlertText({
      buyerName: "A",
      buyerPhone: "9876543210",
      orders: [{ reference: "B2B-1", supplierName: "S", total: 100 }],
    });
    expect(text).not.toMatch(/road|street|pincode|address/i);
  });
});
