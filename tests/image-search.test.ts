import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "../app/api/search/image/route";
import { dedupeImageMatches } from "../lib/ai/image-search-matches";
import {
  decodeImageResultToken,
  encodeImageResultToken,
} from "../lib/ai/image-result-token";
import { normalizeVector } from "../lib/ai/image-embeddings";
import { resetImageSearchRateLimit } from "../lib/ai/image-search-rate-limit";
import {
  IMAGE_SEARCH_MAX_PRODUCTS,
  IMAGE_SEARCH_MAX_UPLOAD_BYTES,
  IMAGE_SEARCH_UPLOAD_FIELD,
} from "../lib/ai/image-search-config";

// Magic-byte prefixes from lib/storage.ts, which is the sniffer the route uses.
const PNG_HEAD = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEAD = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP_HEAD = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

function fileOf(head: Uint8Array, name: string, type: string, size?: number): File {
  const body = new Uint8Array(size ?? head.length);
  body.set(head);
  return new File([body], name, { type });
}

/**
 * The route reads only `formData()` and the forwarding headers, both of which a
 * plain Request provides. It is typed as NextRequest because that is the
 * handler's declared parameter type, so the cast is the narrowest one needed to
 * exercise the handler without booting a Next.js server.
 */
function requestWith(body: FormData, forwardedFor = "203.0.113.9"): NextRequest {
  return new Request("http://localhost/api/search/image", {
    method: "POST",
    body,
    headers: { "x-forwarded-for": forwardedFor },
  }) as NextRequest;
}

beforeEach(() => resetImageSearchRateLimit());
afterEach(() => resetImageSearchRateLimit());

// ---------------------------------------------------------------------------
// Upload validation
//
// Every case here is rejected before any model is loaded, so these run without
// the CLIP weights present.
// ---------------------------------------------------------------------------

describe("POST /api/search/image — upload validation", () => {
  it("rejects a request with no image field", async () => {
    const form = new FormData();
    form.append("somethingElse", "x");

    const response = await POST(requestWith(form));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("missing_image");
  });

  it("rejects an empty file", async () => {
    const form = new FormData();
    form.append(IMAGE_SEARCH_UPLOAD_FIELD, new File([], "empty.png", { type: "image/png" }));

    const response = await POST(requestWith(form));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("missing_image");
  });

  it("rejects an upload over the size limit", async () => {
    const form = new FormData();
    form.append(
      IMAGE_SEARCH_UPLOAD_FIELD,
      fileOf(PNG_HEAD, "big.png", "image/png", IMAGE_SEARCH_MAX_UPLOAD_BYTES + 1),
    );

    const response = await POST(requestWith(form));
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("image_too_large");
  });

  it("accepts an upload exactly at the size limit (rejected later, not on size)", async () => {
    // Proves the boundary is inclusive rather than off-by-one; the request then
    // fails on content because the bytes are a truncated PNG.
    const form = new FormData();
    form.append(
      IMAGE_SEARCH_UPLOAD_FIELD,
      fileOf(PNG_HEAD, "edge.png", "image/png", IMAGE_SEARCH_MAX_UPLOAD_BYTES),
    );

    const response = await POST(requestWith(form, "203.0.113.40"));
    expect(response.status).not.toBe(413);
  });

  it("rejects a non-image body", async () => {
    const form = new FormData();
    form.append(
      IMAGE_SEARCH_UPLOAD_FIELD,
      new File([new TextEncoder().encode("this is not an image")], "notes.txt", {
        type: "text/plain",
      }),
    );

    const response = await POST(requestWith(form));
    expect(response.status).toBe(415);
    expect((await response.json()).code).toBe("unsupported_format");
  });

  it("rejects a PDF", async () => {
    const form = new FormData();
    form.append(
      IMAGE_SEARCH_UPLOAD_FIELD,
      fileOf(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), "spec.pdf", "application/pdf"),
    );

    const response = await POST(requestWith(form));
    expect(response.status).toBe(415);
  });

  it("does not trust a declared image MIME type over the bytes", async () => {
    // Claims PNG, is not an image at all.
    const form = new FormData();
    form.append(
      IMAGE_SEARCH_UPLOAD_FIELD,
      new File([new TextEncoder().encode("<script>alert(1)</script>")], "evil.png", {
        type: "image/png",
      }),
    );

    const response = await POST(requestWith(form));
    expect(response.status).toBe(415);
    expect((await response.json()).code).toBe("unsupported_format");
  });

  it.each([
    ["jpeg", JPEG_HEAD, "image/jpeg"],
    ["png", PNG_HEAD, "image/png"],
    ["webp", WEBP_HEAD, "image/webp"],
  ])("passes %s magic-byte validation", async (_label, head, type) => {
    const form = new FormData();
    form.append(IMAGE_SEARCH_UPLOAD_FIELD, fileOf(head, `x.${type}`, type));

    // Real bytes only: a header-prefixed stub is not a decodable image, so the
    // request gets past validation and fails during inference instead.
    const response = await POST(requestWith(form, `203.0.113.${_label.length + 50}`));
    expect(response.status).not.toBe(415);
    expect(response.status).not.toBe(413);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/search/image — rate limiting", () => {
  it("returns 429 once a client exceeds the window", async () => {
    const rejected = async () => {
      const form = new FormData();
      form.append(IMAGE_SEARCH_UPLOAD_FIELD, fileOf(PNG_HEAD, "x.png", "image/png"));
      return (await POST(requestWith(form, "198.51.100.7"))).status;
    };

    let sawTooMany = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      if ((await rejected()) === 429) {
        sawTooMany = true;
        break;
      }
    }

    expect(sawTooMany).toBe(true);
  });

  it("tracks clients independently", async () => {
    const form = new FormData();
    form.append(IMAGE_SEARCH_UPLOAD_FIELD, fileOf(PNG_HEAD, "x.png", "image/png"));

    for (let attempt = 0; attempt < 15; attempt++) {
      await POST(requestWith(form, "198.51.100.8"));
    }

    const other = await POST(requestWith(form, "198.51.100.9"));
    expect(other.status).not.toBe(429);
  });
});

// ---------------------------------------------------------------------------
// De-duplication
// ---------------------------------------------------------------------------

describe("dedupeImageMatches", () => {
  it("returns a product once even when several of its images match", () => {
    const results = dedupeImageMatches([
      { productId: "p1", similarity: 0.94 },
      { productId: "p1", similarity: 0.91 },
      { productId: "p1", similarity: 0.87 },
    ]);

    expect(results).toEqual([{ productId: "p1", similarity: 0.94 }]);
  });

  it("keeps the highest similarity for a duplicated product", () => {
    const results = dedupeImageMatches([
      { productId: "p1", similarity: 0.7 },
      { productId: "p2", similarity: 0.95 },
      { productId: "p1", similarity: 0.93 },
    ]);

    expect(results).toEqual([
      { productId: "p2", similarity: 0.95 },
      { productId: "p1", similarity: 0.93 },
    ]);
  });

  it("does not let a later, lower score overwrite a higher one", () => {
    const results = dedupeImageMatches([
      { productId: "p1", similarity: 0.93 },
      { productId: "p1", similarity: 0.2 },
    ]);

    expect(results[0].similarity).toBe(0.93);
  });

  it("orders products by descending similarity", () => {
    const results = dedupeImageMatches([
      { productId: "p1", similarity: 0.5 },
      { productId: "p2", similarity: 0.99 },
      { productId: "p3", similarity: 0.7 },
    ]);

    expect(results.map((r) => r.productId)).toEqual(["p2", "p3", "p1"]);
  });

  it("breaks ties deterministically by first appearance", () => {
    const results = dedupeImageMatches([
      { productId: "first", similarity: 0.8 },
      { productId: "second", similarity: 0.8 },
      { productId: "third", similarity: 0.8 },
    ]);

    expect(results.map((r) => r.productId)).toEqual(["first", "second", "third"]);
  });

  it("returns nothing for no matches", () => {
    expect(dedupeImageMatches([])).toEqual([]);
  });

  it("caps the product count", () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      productId: `p${i}`,
      similarity: 1 - i / 1000,
    }));

    expect(dedupeImageMatches(many)).toHaveLength(IMAGE_SEARCH_MAX_PRODUCTS);
    expect(dedupeImageMatches(many, 5)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Result token
// ---------------------------------------------------------------------------

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("image result token", () => {
  it("round-trips an ordered id list", () => {
    const ids = [uuid(1), uuid(2), uuid(3)];

    expect(decodeImageResultToken(encodeImageResultToken(ids))).toEqual(ids);
  });

  it("preserves ranking order", () => {
    const ids = [uuid(9), uuid(3), uuid(7)];

    expect(decodeImageResultToken(encodeImageResultToken(ids))).toEqual(ids);
  });

  it("round-trips an empty list to an empty token", () => {
    expect(decodeImageResultToken(encodeImageResultToken([]))).toBeNull();
  });

  it("stays compact for a full result set", () => {
    const ids = Array.from({ length: IMAGE_SEARCH_MAX_PRODUCTS }, (_, i) => uuid(i));

    // 16 bytes per id, base64url. Comfortably inside a URL, unlike ~4 KB of
    // percent-escaped UUID text.
    expect(encodeImageResultToken(ids).length).toBeLessThan(1400);
  });

  it("caps how many ids it will emit", () => {
    const ids = Array.from({ length: IMAGE_SEARCH_MAX_PRODUCTS + 25 }, (_, i) => uuid(i));

    expect(decodeImageResultToken(encodeImageResultToken(ids))).toHaveLength(
      IMAGE_SEARCH_MAX_PRODUCTS,
    );
  });

  it("returns null for missing, empty and malformed tokens", () => {
    expect(decodeImageResultToken(null)).toBeNull();
    expect(decodeImageResultToken(undefined)).toBeNull();
    expect(decodeImageResultToken("")).toBeNull();
    expect(decodeImageResultToken("not-a-token!!")).toBeNull();
    expect(decodeImageResultToken("aGVsbG8")).toBeNull();
  });

  it("returns null for a truncated token rather than partial ids", () => {
    const encoded = encodeImageResultToken([uuid(1)]);

    // A single byte short of the 16-byte id payload.
    expect(decodeImageResultToken(encoded.slice(0, encoded.length - 2))).toBeNull();
  });

  it("re-encodes a token to the same value", () => {
    const token = encodeImageResultToken([uuid(4), uuid(5)]);

    expect(encodeImageResultToken(decodeImageResultToken(token)!)).toBe(token);
  });

  it("drops ids that are not uuids", () => {
    const encoded = encodeImageResultToken(["not-a-uuid", uuid(1)]);

    expect(decodeImageResultToken(encoded)).toEqual([uuid(1)]);
  });
});

// ---------------------------------------------------------------------------
// Vector normalisation
// ---------------------------------------------------------------------------

describe("normalizeVector", () => {
  it("scales a vector to unit length", () => {
    const unit = normalizeVector([3, 4]);

    expect(unit).toEqual([0.6, 0.8]);
    expect(Math.hypot(...unit)).toBeCloseTo(1, 12);
  });

  it("preserves direction", () => {
    const unit = normalizeVector([11.06, 0, 0]);

    expect(unit[0]).toBeCloseTo(1, 12);
  });

  it("throws on an all-zero vector", () => {
    expect(() => normalizeVector([0, 0, 0])).toThrow(/unusable/);
  });

  it("throws on a non-finite value", () => {
    expect(() => normalizeVector([Number.NaN, 1])).toThrow(/unusable/);
  });
});