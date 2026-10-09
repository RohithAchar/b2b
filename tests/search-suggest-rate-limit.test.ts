import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isSearchSuggestRateLimited,
  resetSearchSuggestRateLimit,
} from "../lib/ai/search-suggest-rate-limit";

describe("isSearchSuggestRateLimited", () => {
  beforeEach(() => resetSearchSuggestRateLimit());
  afterEach(() => resetSearchSuggestRateLimit());

  it("allows the first request from a client", () => {
    expect(isSearchSuggestRateLimited("client-a", 1_000)).toBe(false);
  });

  it("allows sustained typing but blocks hammering within a window", () => {
    const now = 1_000;
    for (let i = 0; i < 120; i++) {
      expect(isSearchSuggestRateLimited("typer", now)).toBe(false);
    }
    expect(isSearchSuggestRateLimited("typer", now)).toBe(true);
  });

  it("resets when the window elapses", () => {
    expect(isSearchSuggestRateLimited("client-b", 1_000)).toBe(false);
    // 61 s later the bucket has expired, so the client starts fresh.
    expect(isSearchSuggestRateLimited("client-b", 62_000)).toBe(false);
  });

  it("tracks clients independently", () => {
    const now = 1_000;
    for (let i = 0; i < 120; i++) {
      isSearchSuggestRateLimited("hammer", now);
    }
    expect(isSearchSuggestRateLimited("hammer", now)).toBe(true);
    expect(isSearchSuggestRateLimited("bystander", now)).toBe(false);
  });
});
