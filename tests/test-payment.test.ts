import { describe, expect, it } from "vitest";
import {
  TEST_UPI_ID,
  buildUpiUri,
  isPayableAmount,
  testPaymentNote,
} from "@/lib/orders/test-payment";

// The payment screen is test-only: no gateway, no real UPI id. These tests pin
// the deep link shape and the amount guard so a malformed link can never be
// rendered with a browser-supplied amount.

describe("test payment helpers", () => {
  it("builds a standard UPI deep link with a server-fixed amount", () => {
    const uri = buildUpiUri({ reference: "B2B-100115", amount: 1250.5 });
    expect(uri.startsWith("upi://pay?")).toBe(true);

    const params = new URLSearchParams(uri.slice("upi://pay?".length));
    expect(params.get("pa")).toBe(TEST_UPI_ID);
    expect(params.get("am")).toBe("1250.50");
    expect(params.get("cu")).toBe("INR");
    expect(params.get("tn")).toBe(testPaymentNote("B2B-100115"));
    expect(params.get("tn")).toContain("B2B-100115");
    expect(params.get("tn")).toContain("TEST MODE");
  });

  it("treats only positive finite amounts as payable", () => {
    expect(isPayableAmount(0)).toBe(false);
    expect(isPayableAmount(-1)).toBe(false);
    expect(isPayableAmount(Number.NaN)).toBe(false);
    expect(isPayableAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isPayableAmount(0.01)).toBe(true);
    expect(isPayableAmount(1250)).toBe(true);
  });
});
