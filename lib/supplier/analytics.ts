// Supplier dashboard analytics: date-range resolution, trend bucketing (pure,
// unit-tested) and the server-side metrics query over orders + storefront_events.
import type { SupabaseClient } from "@supabase/supabase-js";

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

export const DASHBOARD_RANGE_LABELS: Record<DashboardRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "1y": "This year",
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

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Resolve a preset to an absolute [from, to) window. `now` is injectable for tests. */
export function resolveRangeBounds(range: DashboardRange, now: Date = new Date()): RangeBounds {
  const todayStart = startOfUtcDay(now);
  switch (range) {
    case "today":
      return { from: todayStart, to: now };
    case "yesterday":
      return { from: new Date(todayStart.getTime() - DAY_MS), to: todayStart };
    case "7d":
      return { from: new Date(now.getTime() - 7 * DAY_MS), to: now };
    case "90d":
      return { from: new Date(now.getTime() - 90 * DAY_MS), to: now };
    case "1y":
      return { from: new Date(now.getTime() - 365 * DAY_MS), to: now };
    case "lifetime":
      return { from: null, to: now };
    case "30d":
    default:
      return { from: new Date(now.getTime() - 30 * DAY_MS), to: now };
  }
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

function bucketStart(date: Date, granularity: "hour" | "day" | "month"): Date {
  if (granularity === "hour") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()));
  }
  if (granularity === "day") {
    return startOfUtcDay(date);
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function bucketLabel(start: Date, granularity: "hour" | "day" | "month"): string {
  if (granularity === "hour") {
    const hour = start.getUTCHours();
    const suffix = hour < 12 ? "AM" : "PM";
    const twelve = hour % 12 === 0 ? 12 : hour % 12;
    return `${twelve} ${suffix}`;
  }
  if (granularity === "day") {
    return start.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  }
  return start.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function addBucket(start: Date, granularity: "hour" | "day" | "month", index: number): Date {
  const next = new Date(start.getTime());
  if (granularity === "hour") next.setUTCHours(next.getUTCHours() + index);
  else if (granularity === "day") next.setUTCDate(next.getUTCDate() + index);
  else next.setUTCMonth(next.getUTCMonth() + index);
  return next;
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
  const granularity = spanMs <= 2 * DAY_MS ? "hour" : spanMs <= 120 * DAY_MS ? "day" : "month";

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
  /** Action queue: new + confirmed orders of all time (not range-scoped). */
  shipQueue: { count: number; value: number };
  /** Distinct sessions with a cart event but no order event in the window. */
  abandonedCount: number;
  salesSeries: { label: string; sales: number }[];
  conversionSeries: { label: string; rate: number }[];
};

type OrderMetricRow = {
  id: string;
  status: string;
  subtotal: number;
  created_at: string;
};

const ORDERS_PAGE_SIZE = 5000;
const EVENTS_PAGE_SIZE = 10000;

/**
 * Fetch every dashboard metric in three parallel queries and fold them in
 * memory. Throws on query failure — the page renders the error state.
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

  let ordersQuery = supabase
    .from("orders")
    .select("id, status, subtotal, created_at")
    .eq("supplier_id", supplierId)
    .lt("created_at", toISO)
    .order("created_at", { ascending: true })
    .limit(ORDERS_PAGE_SIZE);
  if (fromISO) {
    ordersQuery = ordersQuery.gte("created_at", fromISO);
  }

  let eventsQuery = supabase
    .from("storefront_events")
    .select("session_id, event, created_at")
    .eq("supplier_id", supplierId)
    .lt("created_at", toISO)
    .order("created_at", { ascending: true })
    .limit(EVENTS_PAGE_SIZE);
  if (fromISO) {
    eventsQuery = eventsQuery.gte("created_at", fromISO);
  }

  const shipQuery = supabase
    .from("orders")
    .select("id, subtotal")
    .eq("supplier_id", supplierId)
    .in("status", ["new", "confirmed"])
    .limit(ORDERS_PAGE_SIZE);

  const [{ data: orderRows, error: ordersError }, { data: eventRows, error: eventsError }, { data: shipRows, error: shipError }] =
    await Promise.all([ordersQuery, eventsQuery, shipQuery]);

  if (ordersError) throw new Error(`Dashboard orders query failed: ${ordersError.message}`);
  if (eventsError) throw new Error(`Dashboard events query failed: ${eventsError.message}`);
  if (shipError) throw new Error(`Dashboard ship-queue query failed: ${shipError.message}`);

  const orders = (orderRows ?? []) as OrderMetricRow[];
  const events = ((eventRows ?? []) as EventRow[]).filter((e) => e.event === "view" || e.event === "cart" || e.event === "order");

  const salesTotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
  const newInWindow = orders.filter((o) => o.status === "new");

  const sessionIds = new Set(events.map((e) => e.session_id));
  const orderingSessions = new Set(events.filter((e) => e.event === "order").map((e) => e.session_id));
  const cartSessions = new Set(events.filter((e) => e.event === "cart").map((e) => e.session_id));
  const sessions = sessionIds.size;
  const conversionPct = sessions === 0 ? 0 : Math.round((orderingSessions.size / sessions) * 1000) / 10;

  let abandonedCount = 0;
  for (const session of cartSessions) {
    if (!orderingSessions.has(session)) abandonedCount += 1;
  }

  const shipList = ((shipRows ?? []) as { subtotal: number }[]);
  const series = buildTrendSeries({
    orders: orders.map((o) => ({ created_at: o.created_at, subtotal: o.subtotal })),
    events,
    from,
    to,
  });

  return {
    range,
    salesTotal,
    orderCount: orders.length,
    sessions,
    conversionPct,
    newOrders: {
      count: newInWindow.length,
      value: newInWindow.reduce((sum, o) => sum + o.subtotal, 0),
    },
    shipQueue: {
      count: shipList.length,
      value: shipList.reduce((sum, o) => sum + o.subtotal, 0),
    },
    abandonedCount,
    salesSeries: series.map((p) => ({ label: p.label, sales: p.sales })),
    conversionSeries: series.map((p) => ({ label: p.label, rate: p.conversion })),
  };
}
