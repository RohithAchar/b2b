import { describe, expect, it } from "vitest";
import { fieldIdForMessage } from "../lib/supplier/form-errors";

describe("fieldIdForMessage", () => {
  it.each([
    ["You already use this SKU on another product.", "seller_sku"],
    ["SKU: 3-30 chars, letters/numbers/-/_ .", "seller_sku"],
  ])("maps %s to %s", (message, field) => {
    expect(fieldIdForMessage(message)).toBe(field);
  });

  it("maps image-count/size/type messages to images", () => {
    expect(fieldIdForMessage("Add at least 3 images before submitting.")).toBe("images");
    expect(fieldIdForMessage("At least 3 images are required before submitting")).toBe("images");
    expect(fieldIdForMessage("At most 8 images are allowed")).toBe("images");
    expect(fieldIdForMessage("Products can have up to 8 images total. Remove some before adding more.")).toBe(
      "images",
    );
    expect(fieldIdForMessage("Each image must be under 2 MB.")).toBe("images");
    expect(fieldIdForMessage("Only JPG, PNG or WEBP images are allowed.")).toBe("images");
  });

  it("maps product-level validation messages to their fields", () => {
    const cases: Array<[string, string]> = [
      ["Title needs at least 10 characters.", "title"],
      ["Product title must be at least 10 characters", "title"],
      ["Description is required.", "description"],
      ["Description needs at least 50 characters of text.", "description"],
      ["Product description must be at least 50 characters", "description"],
      ["Pick a subcategory.", "category_id"],
      ["Category is not active", "category_id"],
      ["HSN must be 4-8 digits.", "hsn_code"],
      ["HSN code must be 4-8 digits", "hsn_code"],
      ["Enter a valid YouTube link (watch / youtu.be / embed / shorts).", "youtube_url"],
      ["MOQ must be at least 1.", "moq"],
      ["MOQ must be at least 1", "moq"],
      ["Price must be positive.", "price_per_unit"],
      ["Price must be greater than 0", "price_per_unit"],
      ["Lead time must be between 1 and 90 days", "lead_time_days"],
      ["Invalid GST rate", "gst_rate"],
      ["Pick a valid GST rate.", "gst_rate"],
      ["Invalid unit", "unit"],
    ];
    for (const [message, field] of cases) {
      expect(fieldIdForMessage(message)).toBe(field);
    }
  });

  it("keeps variant-scoped messages on the generic alert", () => {
    expect(fieldIdForMessage("Variant 1: SKU is already used by another of your products")).toBeUndefined();
    expect(fieldIdForMessage("Variant price must be positive.")).toBeUndefined();
    expect(fieldIdForMessage("Each variant needs a label of at least 2 characters")).toBeUndefined();
    expect(fieldIdForMessage("SKU ABC is already used by one of your variants")).toBeUndefined();
    expect(fieldIdForMessage("Variants are invalid.")).toBeUndefined();
    expect(fieldIdForMessage("At most 20 variants are allowed")).toBeUndefined();
  });

  it("returns undefined for unknown or empty messages", () => {
    expect(fieldIdForMessage("Something unexpected broke")).toBeUndefined();
    expect(fieldIdForMessage("")).toBeUndefined();
    expect(fieldIdForMessage("   ")).toBeUndefined();
  });

  it("matches case-insensitively", () => {
    expect(fieldIdForMessage("you ALREADY USE this SKU on another product.")).toBe("seller_sku");
  });
});