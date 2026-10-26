// Supplier dashboard analytics: date-range resolution, trend bucketing (pure,
// unit-tested) and the server-side metrics query over orders + storefront_events.
import type { SupabaseClient } from "@supabase/supabase-js";
import { latestAcceptedQuotation } from "@/lib/orders/quotation";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

export const DASHBOARD_RANGES = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "1y",
  "lifetime",
] as const;

export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

/** Number of whole calendar days a preset includes, including today. */
export function rangeDayCount(range: DashboardRange): number {
  switch (range) {
    case "today":
    case "yesterday":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "1y":
      return 365;
    case "lifetime":
      return 0;
  }
}

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "Last 12 months",
  lifetime: "Lifetime",
};

export function parseDashboardRange(raw: unknown): DashboardRange {
  if (typeof raw === "string" && (DASHBOARD_RANGES as readonly string[]).includes(raw)) {
    return raw as DashboardRange;
  }
  return "30d";
}

export type RangeBounds = {
  /** Inclusive lower bound, or null for lifetime (no lower bound). */
  from: Date | null;
  /** Exclusive upper bound. */
  to: Date;
};

export const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Start of the calendar day in India, expressed as a UTC instant. */
export function startOfIstDay(date: Date): Date {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - IST_OFFSET_MS,
  );
}

/**
 * Resolve a preset to an absolute [from, to) window. Busy-day boundaries use
 * IST so "Today" and "Yesterday" match the supplier's calendar; rolling
 * presets are aligned to the start of the first included IST day.
 */
export function resolveRangeBounds(range: DashboardRange, now: Date = new Date()): RangeBounds {
  const todayStart = startOfIstDay(now);
  switch (range) {
    case "today":
      return { from: todayStart, to: now };
    case "yesterday":
      return { from: new Date(todayStart.getTime() - DAY_MS), to: todayStart };
    case "7d":
      return { from: new Date(todayStart.getTime() - 6 * DAY_MS), to: now };
    case "90d":
      return { from: new Date(todayStart.getTime() - 89 * DAY_MS), to: now };
    case "1y":
      return { from: new Date(todayStart.getTime() - 364 * DAY_MS), to: now };
    case "lifetime":
      return { from: null, to: now };
    case "30d":
    default:
      return { from: new Date(todayStart.getTime() - 29 * DAY_MS), to: now };
  }
}

/**
 * Previous comparable window. "Today" compares the same elapsed slice of
 * yesterday; whole-day presets compare the equally long window immediately
 * before their first day. Lifetime has no meaningful comparison.
 */
export function resolvePreviousBounds(
  range: DashboardRange,
  now: Date = new Date(),
): RangeBounds | null {
  const current = resolveRangeBounds(range, now);
  if (!current.from || range === "lifetime") return null;
  if (range === "today") {
    return {
      from: new Date(current.from.getTime() - DAY_MS),
      to: new Date(current.to.getTime() - DAY_MS),
    };
  }
  const days = rangeDayCount(range);
  return {
    from: new Date(current.from.getTime() - days * DAY_MS),
    to: current.from,
  };
}

/**
 * Number of days the averages divide by. Lifetime has no lower bound, so the
 * earliest row is the real measurement start; with no data, one day avoids a
 * divide-by-zero without inventing a window.
 */
export function windowDays(
  from: Date | null,
  to: Date,
  earliest: Date | null,
): number {
  if (from) return Math.max((to.getTime() - from.getTime()) / DAY_MS, 1 / 24);
  if (earliest) {
    return Math.max((to.getTime() - earliest.getTime()) / DAY_MS, 1);
  }
  return 1;
}

export function earliestDate(dates: (string | Date)[]): Date | null {
  let earliest: Date | null = null;
  for (const value of dates) {
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) continue;
    if (!earliest || date < earliest) earliest = date;
  }
  return earliest;
}

// ---------------------------------------------------------------------------
// Trend bucketing (pure)
// ---------------------------------------------------------------------------

export type TrendPoint = {
  /** Stable bucket key (ISO). */
  key: string;
  /** Axis label: "2 PM", "12 Oct", or "Oct ’26". */
  label: string;
  sales: number;
  orders: number;
  /** Distinct sessions with any event in the bucket. */
  sessions: number;
  /** % of sessions with an order event, 0–100. */
  conversion: number;
};

type OrderRow = { created_at: string; subtotal: number };
type EventRow = { created_at: string; session_id: string; event: string };

export type ChartGranularity = "hour" | "day" | "month";

export function chartGranularity(spanMs: number): ChartGranularity {
  return spanMs <= 2 * DAY_MS ? "hour" : spanMs <= 120 * DAY_MS ? "day" : "month";
}

export function bucketStart(date: Date, granularity: ChartGranularity): Date {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  if (granularity === "hour") {
    return new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate(),
        shifted.getUTCHours(),
      ) - IST_OFFSET_MS,
    );
  }
  if (granularity === "day") return startOfIstDay(date);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - IST_OFFSET_MS,
  );
}

export function bucketLabel(start: Date, granularity: ChartGranularity): string {
  if (granularity === "hour") {
    const hour = new Date(start.getTime() + IST_OFFSET_MS).getUTCHours();
    const suffix = hour < 12 ? "AM" : "PM";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return `${twelve} ${suffix}`;
  }
  if (granularity === "day") {
    return start.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    });
  }
  return start.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function addBucket(
  start: Date,
  granularity: ChartGranularity,
  index: number,
): Date {
  const next = new Date(start.getTime() + IST_OFFSET_MS);
  if (granularity === "hour") next.setUTCHours(next.getUTCHours() + index);
  else if (granularity === "day") next.setUTCDate(next.getUTCDate() + index);
  else next.setUTCMonth(next.getUTCMonth() + index);
  return new Date(next.getTime() - IST_OFFSET_MS);
}

/**
 * Fold order + event rows into a continuous series — every bucket in the
 * window appears, even empty ones, so charts never show gaps. For lifetime,
 * the window starts at the earliest row (or `to` when there is no data).
 */
export function buildTrendSeries(args: {
  orders: OrderRow[];
  events: EventRow[];
  from: Date | null;
  to: Date;
}): TrendPoint[] {
  const { orders, events, to } = args;
  const earliestRow = [...orders, ...events]
    .map((r) => new Date(r.created_at).getTime())
    .filter((t) => Number.isFinite(t) && t <= to.getTime());
  const windowStart = args.from ?? (earliestRow.length > 0 ? new Date(Math.min(...earliestRow)) : to);

  const spanMs = Math.max(to.getTime() - windowStart.getTime(), 0);
  const granularity = chartGranularity(spanMs);

  const first = bucketStart(windowStart, granularity);
  const points: TrendPoint[] = [];
  const indexByKey = new Map<string, TrendPoint>();
  for (let i = 0; ; i++) {
    const start = addBucket(first, granularity, i);
    if (start.getTime() > to.getTime()) break;
    // Guard against unbounded lifetime windows producing thousands of
    // buckets: cap at 366 points (hourly cap is naturally small).
    if (points.length >= 366) break;
    const key = start.toISOString();
    const point: TrendPoint = { key, label: bucketLabel(start, granularity), sales: 0, orders: 0, sessions: 0, conversion: 0 };
    points.push(point);
    indexByKey.set(key, point);
  }

  for (const order of orders) {
    const at = new Date(order.created_at);
    if (at < windowStart || at > to) continue;
    const point = indexByKey.get(bucketStart(at, granularity).toISOString());
    if (!point) continue;
    point.sales += order.subtotal;
    point.orders += 1;
  }

  const sessionsByBucket = new Map<string, Set<string>>();
  const orderingSessionsByBucket = new Map<string, Set<string>>();
  for (const event of events) {
    const at = new Date(event.created_at);
    if (at < windowStart || at > to) continue;
    const key = bucketStart(at, granularity).toISOString();
    if (!indexByKey.has(key)) continue;
    if (!sessionsByBucket.has(key)) sessionsByBucket.set(key, new Set());
    sessionsByBucket.get(key)?.add(event.session_id);
    if (event.event === "order") {
      if (!orderingSessionsByBucket.has(key)) orderingSessionsByBucket.set(key, new Set());
      orderingSessionsByBucket.get(key)?.add(event.session_id);
    }
  }
  for (const point of points) {
    const sessions = sessionsByBucket.get(point.key)?.size ?? 0;
    const ordering = orderingSessionsByBucket.get(point.key)?.size ?? 0;
    point.sessions = sessions;
    point.conversion = sessions === 0 ? 0 : Math.round((ordering / sessions) * 1000) / 10;
  }

  return points;
}

// ---------------------------------------------------------------------------
// Server metrics query
// ---------------------------------------------------------------------------

export type DashboardMetrics = {
  range: DashboardRange;
  salesTotal: number;
  orderCount: number;
  sessions: number;
  conversionPct: number;
  newOrders: { count: number; value: number };
  /** Action queue: confirmed orders of all time (not range-scoped). */
  shipQueue: { count: number; value: number };
  /** Orders with an unanswered quotation, all time. */
  quoteQueue: { count: number; value: number };
  /** Distinct sessions with a cart event but no order event in the window. */
  abandonedCount: number;
  salesSeries: { label: string; sales: number }[];
  conversionSeries: { label: string; rate: number }[];
  seriesGranularity: ChartGranularity;
};

type QuotationLink = {
  status: string;
  version: number;
  total: number;
};

type OrderMetricRow = {
  id: string;
  status: string;
  subtotal: number;
  created_at: string;
  quotations?: QuotationLink[];
};

function orderValue(order: OrderMetricRow): number {
  return Number(latestAcceptedQuotation(order.quotations)?.total ?? order.subtotal);
}

/**
 * Fetch every dashboard metric in three paginated queries and fold them in
 * memory. Throws on query failure or a truncated scan — the page renders the
 * error state instead of a silently undercounted number.
 */
export async function getDashboardMetrics(
  supabase: SupabaseClient,
  supplierId: string,
  range: DashboardRange,
  now: Date = new Date(),
): Promise<DashboardMetrics> {
  const { from, to } = resolveRangeBounds(range, now);
  const fromISO = from?.toISOString() ?? null;
  const toISO = to.toISOString();

  const [orders, eventRows, shipList, quotedList] = await Promise.all([
    fetchAllRows<OrderMetricRow>("Dashboard orders", (offset, limit) => {
      let query = supabase
        .from("orders")
        .select("id, status, subtotal, created_at, quotations(status, version, total)")
        .eq("supplier_id", supplierId)
        .lt("created_at", toISO)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, limit);
      if (fromISO) query = query.gte("created_at", fromISO);
      return query;
    }),
    fetchAllRows<EventRow>("Dashboard events", (offset, limit) => {
      let query = supabase
        .from("storefront_events")
        .select("session_id, event, created_at")
        .eq("supplier_id", supplierId)
        .lt("created_at", toISO)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, limit);
      if (fromISO) query = query.gte("created_at", fromISO);
      return query;
    }),
    fetchAllRows<OrderMetricRow>("Dashboard ship queue", (offset, limit) =>
      supabase
        .from("orders")
        .select("id, status, subtotal, created_at, quotations(status, version, total)")
        .eq("supplier_id", supplierId)
        .eq("status", "confirmed")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, limit),
    ),
    fetchAllRows<OrderMetricRow>("Dashboard quote queue", (offset, limit) =>
      supabase
        .from("orders")
        .select("id, status, subtotal, created_at, quotations(status, version, total)")
        .eq("supplier_id", supplierId)
        .eq("status", "quoted")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, limit),
    ),
  ]);

  const waitingOnBuyer = quotedList.filter(
    (order) => !latestAcceptedQuotation(order.quotations),
  );

  const liveOrders = orders.filter((order) => order.status !== "cancelled");
  const events = eventRows.filter(
    (event) => event.event === "view" || event.event === "cart" || event.event === "order",
  );

  const salesTotal = liveOrders.reduce((sum, order) => sum + orderValue(order), 0);
  const newInWindow = liveOrders.filter((order) => order.status === "new");

  const sessionIds = new Set(events.map((event) => event.session_id));
  const orderingSessions = new Set(
    events.filter((event) => event.event === "order").map((event) => event.session_id),
  );
  const cartSessions = new Set(
    events.filter((event) => event.event === "cart").map((event) => event.session_id),
  );
  const sessions = sessionIds.size;
  const conversionPct =
    sessions === 0 ? 0 : Math.round((orderingSessions.size / sessions) * 1000) / 10;

  let abandonedCount = 0;
  for (const session of cartSessions) {
    if (!orderingSessions.has(session)) abandonedCount += 1;
  }

  const series = buildTrendSeries({
    orders: liveOrders.map((order) => ({
      created_at: order.created_at,
      subtotal: orderValue(order),
    })),
    events,
    from,
    to,
  });
  const seriesStart =
    from ??
    earliestDate([
      ...liveOrders.map((order) => order.created_at),
      ...events.map((event) => event.created_at),
    ]) ??
    to;
  const seriesGranularity = chartGranularity(
    Math.max(to.getTime() - seriesStart.getTime(), 0),
  );

  return {
    range,
    salesTotal,
    orderCount: liveOrders.length,
    sessions,
    conversionPct,
    newOrders: {
      count: newInWindow.length,
      value: newInWindow.reduce((sum, order) => sum + orderValue(order), 0),
    },
    shipQueue: {
      count: shipList.length,
      value: shipList.reduce((sum, order) => sum + orderValue(order), 0),
    },
    quoteQueue: {
      count: waitingOnBuyer.length,
      value: waitingOnBuyer.reduce((sum, order) => sum + orderValue(order), 0),
    },
    abandonedCount,
    salesSeries: series.map((point) => ({ label: point.label, sales: point.sales })),
    conversionSeries: series.map((point) => ({ label: point.label, rate: point.conversion })),
    seriesGranularity,
  };
}
