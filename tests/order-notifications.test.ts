import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_LABELS,
  notificationText,
  type NotificationTemplate,
} from "@/lib/notifications/order-notifications";
import {
  normalizePhone,
  whatsappConfigured,
} from "@/lib/notifications/whatsapp";

// WhatsApp is notification-only: messages carry business facts and a secure
// order-page link, never the delivery address or the recipient's phone.
// These tests pin that rule down for every template.

const ORDER_ID = "11111111-2222-3333-4444-555555555555";

const ALL_TEMPLATES: NotificationTemplate[] = [
  "new_order_supplier",
  "quotation_sent_buyer",
  "quotation_accepted_supplier",
  "quotation_rejected_supplier",
  "order_confirmed_buyer",
  "order_rejected_buyer",
  "order_shipped_buyer",
  "order_delivered_buyer",
  "payment_confirmed_buyer",
];

describe("notificationText", () => {
  const payload = {
    reference: "B2B-100042",
    buyer_name: "Acme Retail",
    total: 12500,
    version: 2,
    reason: "Out of stock",
    carrier: "Delhivery",
    tracking_ref: "DLV123456",
  };

  it("builds a message with the reference and a secure order link for every template", () => {
    for (const template of ALL_TEMPLATES) {
      const text = notificationText(template, ORDER_ID, payload);
      expect(text, template).toBeTruthy();
      expect(text!, template).toContain("B2B-100042");
      const link = template.endsWith("_supplier")
        ? `/supplier/dashboard/orders/${ORDER_ID}`
        : `/orders/${ORDER_ID}`;
      expect(text!, template).toContain(link);
    }
  });

  it("never leaks addresses, phone numbers or GST data", () => {
    const addressLeak = {
      ...payload,
      line1: "12 MG Road",
      line2: "Sector 14",
      pincode: "560001",
      phone: "9876543210",
      gstin: "24AAAAA0000A1Z5",
    };
    for (const template of ALL_TEMPLATES) {
      const text = notificationText(template, ORDER_ID, addressLeak);
      expect(text, template).toBeTruthy();
      expect(text!, template).not.toMatch(
        /MG Road|Sector 14|560001|9876543210|24AAAAA0000A1Z5/,
      );
    }
  });

  it("returns null for an unknown template instead of guessing", () => {
    expect(
      notificationText("nope" as NotificationTemplate, ORDER_ID, payload),
    ).toBeNull();
  });

  it("labels every template for the notification trail UI", () => {
    for (const template of ALL_TEMPLATES) {
      expect(NOTIFICATION_LABELS[template], template).toBeTruthy();
    }
  });
});

describe("whatsapp provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports as unconfigured without credentials (mock provider path)", () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    expect(whatsappConfigured()).toBe(false);
  });

  it("reports as configured when both credentials exist", () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "12345");
    expect(whatsappConfigured()).toBe(true);
  });

  it("normalizes Indian mobile numbers and rejects anything else", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("551234567890")).toBeNull();
  });
});
