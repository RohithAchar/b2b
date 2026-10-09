import { describe, expect, it } from "vitest";
import {
  escapeIlikePattern,
  normalizeSuggestQuery,
  SUGGEST_MAX_QUERY,
  SUGGEST_MIN_CHARS,
} from "../lib/search-suggest";

describe("normalizeSuggestQuery", () => {
  it("trims whitespace", () => {
    expect(normalizeSuggestQuery("  steel  ")).toBe("steel");
  });

  it("returns empty for nullish input", () => {
    expect(normalizeSuggestQuery(null)).toBe("");
    expect(normalizeSuggestQuery(undefined)).toBe("");
  });

  it("caps overly long input", () => {
    expect(normalizeSuggestQuery("a".repeat(1000))).toHaveLength(
      SUGGEST_MAX_QUERY,
    );
  });
});

describe("SUGGEST_MIN_CHARS", () => {
  it("requires at least two characters before fetching", () => {
    expect(SUGGEST_MIN_CHARS).toBe(2);
    expect(normalizeSuggestQuery("a").length < SUGGEST_MIN_CHARS).toBe(true);
    expect(normalizeSuggestQuery("ab").length < SUGGEST_MIN_CHARS).toBe(false);
  });
});

describe("escapeIlikePattern", () => {
  it("leaves plain queries untouched", () => {
    expect(escapeIlikePattern("cotton fabric")).toBe("cotton fabric");
  });

  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeIlikePattern("100%")).toBe("100\\%");
    expect(escapeIlikePattern("a_b")).toBe("a\\_b");
    expect(escapeIlikePattern("a\\b")).toBe("a\\\\b");
    expect(escapeIlikePattern("%_%\\")).toBe("\\%\\_\\%\\\\");
  });
});
