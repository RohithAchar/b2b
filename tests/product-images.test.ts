import { describe, expect, it } from "vitest";
import {
  existingImageKey,
  orderImagePaths,
  resolvePrimaryImagePath,
  stagedImageIndex,
  stagedImageKey,
} from "../lib/supplier/products";

describe("primary image tokens", () => {
  it("builds existing and staged keys", () => {
    expect(existingImageKey("supplier/product.jpg")).toBe(
      "existing:supplier/product.jpg"
    );
    expect(stagedImageKey(2)).toBe("new:2");
  });

  it("reads a staged index", () => {
    expect(stagedImageIndex("new:3")).toBe(3);
    expect(stagedImageIndex("new:-1")).toBe(null);
    expect(stagedImageIndex("new:nope")).toBe(null);
    expect(stagedImageIndex("existing:supplier/product.jpg")).toBe(null);
  });
});

describe("resolvePrimaryImagePath", () => {
  it("resolves an existing path only while it is still kept", () => {
    expect(
      resolvePrimaryImagePath(
        "existing:supplier/one.jpg",
        ["supplier/one.jpg", "supplier/two.jpg"],
        []
      )
    ).toBe("supplier/one.jpg");

    expect(
      resolvePrimaryImagePath(
        "existing:supplier/removed.jpg",
        ["supplier/one.jpg"],
        []
      )
    ).toBe(null);
  });

  it("resolves a staged index against the uploaded paths", () => {
    expect(
      resolvePrimaryImagePath("new:1", [], ["new-a.jpg", "new-b.jpg"])
    ).toBe("new-b.jpg");
    expect(resolvePrimaryImagePath("new:5", [], ["new-a.jpg"])).toBe(null);
    expect(resolvePrimaryImagePath("new:-1", [], ["new-a.jpg"])).toBe(null);
  });

  it("returns null for empty or unknown tokens", () => {
    expect(resolvePrimaryImagePath("", [], ["a.jpg"])).toBe(null);
    expect(resolvePrimaryImagePath("unknown", [], ["a.jpg"])).toBe(null);
  });
});

describe("orderImagePaths", () => {
  it("moves the primary path to the front and keeps the rest in order", () => {
    expect(orderImagePaths(["a.jpg", "b.jpg", "c.jpg"], "c.jpg")).toEqual([
      "c.jpg",
      "a.jpg",
      "b.jpg",
    ]);
  });

  it("leaves the order untouched when the primary is missing", () => {
    expect(orderImagePaths(["a.jpg", "b.jpg"], null)).toEqual([
      "a.jpg",
      "b.jpg",
    ]);
    expect(orderImagePaths(["a.jpg", "b.jpg"], "missing.jpg")).toEqual([
      "a.jpg",
      "b.jpg",
    ]);
  });
});
