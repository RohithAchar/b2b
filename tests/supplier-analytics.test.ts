import { describe, expect, it } from "vitest";
import {
  buildTrendSeries,
  parseDashboardRange,
  resolveRangeBounds,
} from "../lib/supplier/analytics";
import { changePct } from "../lib/supplier/sales-analytics";
import { buildTrafficSeries } from "../lib/supplier/traffic-analytics";
import { buildUnitsSeries } from "../lib/supplier/product-analytics";
import { classifyDevice, classifyTrafficSource } from "../lib/storefront/session-cookie";
import { formatRupees } from "../lib/format";

const NOW = new Date("2026-10-13T12:00:00Z");

describe("parseDashboardRange", () => {
  it("accepts known presets and falls back to 30d", () => {
    expect(parseDashboardRange("today")).toBe("today");
    expect(parseDashboardRange("lifetime")).toBe("lifetime");
    expect(parseDashboardRange("bogus")).toBe("30d");
    expect(parseDashboardRange(undefined)).toBe("30d");
  });
});

describe("resolveRangeBounds", () => {
  it("resolves today to the UTC day start", () => {
    const { from, to } = resolveRangeBounds("today", NOW);
    expect(from?.toISOString()).toBe("2026-10-13T00:00:00.000Z");
    expect(to).toBe(NOW);
  });

  it("resolves yesterday to the previous UTC day", () => {
    const { from, to } = resolveRangeBounds("yesterday", NOW);
    expect(from?.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("resolves rolling windows and lifetime", () => {
    expect(resolveRangeBounds("7d", NOW).from?.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(resolveRangeBounds("1y", NOW).from?.toISOString()).toBe("2025-10-13T12:00:00.000Z");
    expect(resolveRangeBounds("lifetime", NOW).from).toBeNull();
  });
});

describe("buildTrendSeries", () => {
  it("emits continuous daily buckets including empty ones", () => {
    const from = new Date("2026-10-10T00:00:00Z");
    const to = new Date("2026-10-12T12:00:00Z");
    const points = buildTrendSeries({
      orders: [{ created_at: "2026-10-11T10:00:00Z", subtotal: 5000 }],
      events: [],
      from,
      to,
    });
    expect(points.map((p) => p.label)).toEqual(["10 Oct", "11 Oct", "12 Oct"]);
    expect(points[1]?.sales).toBe(5000);
    expect(points[1]?.orders).toBe(1);
    expect(points[0]?.sales).toBe(0);
  });

  it("uses hourly buckets for short windows", () => {
    const points = buildTrendSeries({
      orders: [{ created_at: "2026-10-13T10:30:00Z", subtotal: 2500 }],
      events: [],
      from: new Date("2026-10-13T00:00:00Z"),
      to: NOW,
    });
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]?.label).toMatch(/(AM|PM)$/);
  });

  it("computes sessions and conversion per bucket", () => {
    const from = new Date("2026-10-10T00:00:00Z");
    const to = new Date("2026-10-10T23:59:59Z");
    const points = buildTrendSeries({
      orders: [],
      events: [
        { created_at: "2026-10-10T09:05:00Z", session_id: "a", event: "view" },
        { created_at: "2026-10-10T10:00:00Z", session_id: "b", event: "view" },
        { created_at: "2026-10-10T09:40:00Z", session_id: "a", event: "order" },
      ],
      from,
      to,
    });
    const morning = points.find((p) => p.label === "9 AM");
    expect(morning?.sessions).toBe(1);
    expect(morning?.conversion).toBe(100);
  });

  it("starts lifetime windows at the earliest row", () => {
    const points = buildTrendSeries({
      orders: [{ created_at: "2026-03-15T10:00:00Z", subtotal: 1000 }],
      events: [],
      from: null,
      to: NOW,
    });
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]?.label).toBe("Mar 26");
  });
});

describe("formatRupees", () => {
  it("uses Indian digit grouping", () => {
    expect(formatRupees(1157449)).toBe("₹11,57,449");
    expect(formatRupees(2500)).toBe("₹2,500");
  });
});

describe("changePct", () => {
  it("computes rounded change and null when previous is zero", () => {
    expect(changePct(110, 100)).toBe(10);
    expect(changePct(90, 100)).toBe(-10);
    expect(changePct(0, 0)).toBeNull();
    expect(changePct(50, 0)).toBeNull();
  });
});

describe("classifyTrafficSource", () => {
  it("buckets referrers coarsely", () => {
    expect(classifyTrafficSource("")).toBe("direct");
    expect(classifyTrafficSource("not a url")).toBe("direct");
    expect(classifyTrafficSource("https://www.google.com/search?q=x")).toBe("search");
    expect(classifyTrafficSource("https://instagram.com/p/1")).toBe("social");
    expect(classifyTrafficSource("https://example-blog.com/post")).toBe("referral");
  });
});

describe("classifyDevice", () => {
  it("buckets user agents coarsely, tablets first", () => {
    expect(classifyDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(classifyDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile Safari/537.36")).toBe("mobile");
    expect(classifyDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile/15E148")).toBe("tablet");
    expect(classifyDevice("")).toBe("desktop");
  });
});

describe("buildTrafficSeries", () => {
  it("counts views and distinct visitors per bucket, continuously", () => {
    const points = buildTrafficSeries({
      views: [
        { created_at: "2026-10-10T09:05:00Z", session_id: "a" },
        { created_at: "2026-10-10T09:40:00Z", session_id: "a" },
        { created_at: "2026-10-10T10:10:00Z", session_id: "b" },
      ],
      from: new Date("2026-10-10T00:00:00Z"),
      to: new Date("2026-10-10T23:59:59Z"),
    });
    const morning = points.find((p) => p.label === "9 AM");
    expect(morning?.views).toBe(2);
    expect(morning?.visitors).toBe(1);
    expect(points.length).toBe(24);
  });
});

describe("buildUnitsSeries", () => {
  it("sums quantities per bucket, continuously", () => {
    const points = buildUnitsSeries({
      rows: [
        { created_at: "2026-10-10T09:05:00Z", quantity: 4 },
        { created_at: "2026-10-10T09:40:00Z", quantity: 6 },
        { created_at: "2026-10-12T10:10:00Z", quantity: 2 },
      ],
      from: new Date("2026-10-10T00:00:00Z"),
      to: new Date("2026-10-12T12:00:00Z"),
    });
    expect(points.map((p) => p.label)).toEqual(["10 Oct", "11 Oct", "12 Oct"]);
    expect(points[0]?.units).toBe(10);
    expect(points[1]?.units).toBe(0);
    expect(points[2]?.units).toBe(2);
  });
});
