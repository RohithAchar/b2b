import { describe, expect, it } from "vitest";
import { buildAuthCallbackUrl, resolveAppUrl } from "../lib/auth/origin";

function headers(entries: Record<string, string | null> = {}) {
  const map = new Map<string, string | null>(
    Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    get(name: string): string | null {
      return map.get(name.toLowerCase()) ?? null;
    },
  };
}

describe("resolveAppUrl", () => {
  it("resolves localhost via the Origin header", () => {
    expect(resolveAppUrl(headers({ origin: "http://localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("resolves 127.0.0.1 via the Host header", () => {
    expect(
      resolveAppUrl(headers({ host: "127.0.0.1:3000" })),
    ).toBe("http://127.0.0.1:3000");
  });

  it("prefers x-forwarded-* headers for production (Vercel)", () => {
    const result = resolveAppUrl(
      headers({
        "x-forwarded-proto": "https",
        "x-forwarded-host": "b2b-ox-m.vercel.app",
        origin: "http://localhost:3000",
      }),
    );
    expect(result).toBe("https://b2b-ox-m.vercel.app");
  });

  it("falls back to the Host header when Origin is absent", () => {
    expect(resolveAppUrl(headers({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("falls back to the Host header when Origin is null", () => {
    expect(resolveAppUrl(headers({ origin: null, host: "localhost:3000" }))).toBe(
      "http://localhost:3000",
    );
  });

  it("treats non-local hosts as https", () => {
    expect(resolveAppUrl(headers({ host: "myapp.example.com" }))).toBe(
      "https://myapp.example.com",
    );
  });

  it("keeps localhost http even when only x-forwarded-proto is present", () => {
    expect(
      resolveAppUrl(
        headers({ "x-forwarded-proto": "https", host: "localhost:3000" }),
      ),
    ).toBe("http://localhost:3000");
  });

  it("uses https from forwarded proto+host even for a local-looking host", () => {
    expect(
      resolveAppUrl(
        headers({
          "x-forwarded-proto": "https",
          "x-forwarded-host": "localhost:3000",
        }),
      ),
    ).toBe("https://localhost:3000");
  });

  it("rejects malformed origins", () => {
    expect(resolveAppUrl(headers({ origin: "null" }))).toBeNull();
    expect(resolveAppUrl(headers({ origin: "ftp://localhost:3000" }))).toBeNull();
    expect(resolveAppUrl(headers({ origin: "http://" }))).toBeNull();
  });

  it("returns null when nothing resolves", () => {
    expect(resolveAppUrl(headers({}))).toBeNull();
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds a URL with the encoded next path", () => {
    expect(
      buildAuthCallbackUrl(headers({ origin: "http://localhost:3000" }), "/"),
    ).toBe("http://localhost:3000/auth/callback?next=%2F");
  });

  it("builds a URL with nested next paths", () => {
    expect(
      buildAuthCallbackUrl(
        headers({ origin: "http://localhost:3000" }),
        "/supplier/onboarding",
      ),
    ).toBe(
      "http://localhost:3000/auth/callback?next=%2Fsupplier%2Fonboarding",
    );
  });

  it("returns null when the origin cannot be resolved", () => {
    expect(buildAuthCallbackUrl(headers({}), "/")).toBeNull();
  });
});