import { describe, expect, it } from "vitest";
import {
  contactMessage,
  whatsappContactLink,
} from "@/lib/orders/whatsapp-link";

// The buyer -> supplier chat link is a plain deep link: no credentials, no
// automatic sending, and the message may only carry the order reference and
// supplier name. The builder must reject anything that isn't a plausible
// Indian mobile rather than emit a broken or leaky link.

describe("whatsappContactLink", () => {
  it("builds a wa.me link from a 10-digit national number", () => {
    expect(whatsappContactLink("9876543210", "Hello")).toBe(
      "https://wa.me/919876543210?text=Hello",
    );
  });

  it("accepts common +91 / 0 prefixed forms", () => {
    expect(whatsappContactLink("+91 98765-43210", "Hi")).toBe(
      "https://wa.me/919876543210?text=Hi",
    );
    expect(whatsappContactLink("09876543210", "Hi")).toBe(
      "https://wa.me/919876543210?text=Hi",
    );
  });

  it("URL-encodes the message", () => {
    expect(whatsappContactLink("9876543210", "Order B2B-100001 ready?")).toBe(
      "https://wa.me/919876543210?text=Order%20B2B-100001%20ready%3F",
    );
  });

  it("rejects missing, malformed and non-Indian numbers", () => {
    expect(whatsappContactLink(null, "Hi")).toBeNull();
    expect(whatsappContactLink("", "Hi")).toBeNull();
    expect(whatsappContactLink("12345", "Hi")).toBeNull();
    expect(whatsappContactLink("551234567890", "Hi")).toBeNull();
    // Leading digit outside the Indian mobile range.
    expect(whatsappContactLink("5876543210", "Hi")).toBeNull();
  });
});

describe("contactMessage", () => {
  it("contains only the supplier name and order reference", () => {
    const message = contactMessage("Shree Traders", "B2B-100042");
    expect(message).toBe(
      "Hello Shree Traders, I would like to discuss my order B2B-100042.",
    );
    // Guards against accidental leakage of addresses or prices later.
    expect(message).not.toMatch(/₹|address|street|pincode/i);
  });
});
