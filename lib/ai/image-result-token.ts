import { IMAGE_SEARCH_MAX_PRODUCTS } from "./image-search-config.ts";

/**
 * Carries an image-search result set from the API response into the /products
 * URL.
 *
 * Deliberately stateless: no table, no row to expire, no cleanup job. The token
 * holds only already-public product ids in rank order, so the worst a tampered
 * token can do is list products that /products would have listed anyway — every
 * consumer still goes through getProducts, which filters on
 * `status = 'approved' and is_hidden = false` (and RLS enforces it again).
 *
 * Encoding is 16 raw bytes per id rather than the 36-character text form, which
 * keeps a 60-product result near 1.3 KB instead of ~4 KB of percent-escaped
 * UUIDs.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function encodeImageResultToken(productIds: readonly string[]): string {
  const valid = productIds.filter((id) => UUID_RE.test(id)).slice(0, IMAGE_SEARCH_MAX_PRODUCTS);

  const bytes = new Uint8Array(valid.length * 16);
  valid.forEach((id, index) => {
    const hex = id.replace(/-/g, "");
    for (let byte = 0; byte < 16; byte++) {
      bytes[index * 16 + byte] = parseInt(hex.slice(byte * 2, byte * 2 + 2), 16);
    }
  });

  return toBase64Url(bytes);
}

/**
 * Returns null for anything that is not a well-formed token, so a hand-edited or
 * truncated `img=` parameter degrades to "no image search" instead of erroring.
 * Over-long tokens are clamped rather than rejected.
 */
export function decodeImageResultToken(token: string | null | undefined): string[] | null {
  if (!token) return null;

  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length === 0 || bytes.length % 16 !== 0) return null;

  const count = Math.min(bytes.length / 16, IMAGE_SEARCH_MAX_PRODUCTS);
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    let hex = "";
    for (let byte = 0; byte < 16; byte++) {
      hex += bytes[index * 16 + byte].toString(16).padStart(2, "0");
    }
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    if (UUID_RE.test(id)) ids.push(id);
  }

  return ids.length > 0 ? ids : null;
}