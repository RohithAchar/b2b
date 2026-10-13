// Supplier sales analytics: current-vs-previous window comparison, regional /
// source / category breakdowns. Pure helpers are unit-tested; the server
// query folds orders + order_items + storefront_events in memory.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTrendSeries,
  resolveRangeBounds,
  type DashboardRange,
} from "@/lib/supplier/analytics";

export type DeltaMetric = {
  value: number;
  /** % change vs the previous equal-length window; null when not comparable. */
  changePct: number | null;
};

export type ShareSlice = {
  label: string;
  sales: number;
  sharePct: number;
};

export type SalesAnalytics = {
  range: DashboardRange;
  avgOrdersPerDay: DeltaMetric;
  avgOrderValue: DeltaMetric;
  avgSalesPerDay: DeltaMetric;
  returningPct: DeltaMetric;
  totalOrders: DeltaMetric;
  grossSales: DeltaMetric;
  conversionPct: number;
  sessions: number;
  ordersSeries: { label: string; orders: number }[];
  salesSeries: { label: string; sales: number }[];
  conversionSeries: { label: string; rate: number }[];
  topRegions: ShareSlice[];
  topSources: ShareSlice[];
  topCategories: ShareSlice[];
};

/** % change of current vs previous; null when previous is 0 (not comparable). */
export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

type SalesOrderRow = {
  id: string;
  status: string;
  subtotal: number;
  buyer_id: string;
  region: string | null;
  created_at: string;
};

type SalesEventRow = {
  session_id: string;
  event: string;
  source: string | null;
  buyer_id: string | null;
  created_at: string;
};

type ItemRow = {
  order_id: string;
  quantity: number;
  unit_price: number;
  // Supabase embeds to-one relations as arrays in its inferred types.
  product: { category_id: string | null } | { category_id: string | null }[] | null;
};

function itemCategoryId(item: ItemRow): string | null {
  const product = Array.isArray(item.product) ? item.product[0] : item.product;
  return product?.category_id ?? null;
}

function conversionOf(events: SalesEventRow[]): number {
  const sessions = new Set(events.map((e) => e.session_id));
  if (sessions.size === 0) return 0;
  const ordering = new Set(
    events.filter((e) => e.event === "order").map((e) => e.session_id),
  );
  return Math.round((ordering.size / sessions.size) * 1000) / 10;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDERS_PAGE_SIZE = 5000;
const EVENTS_PAGE_SIZE = 10000;

function windowedQuery(
  supabase: SupabaseClient,
  table: "orders" | "storefront_events",
  columns: string,
  supplierId: string,
  from: Date | null,
  to: Date,
  limit: number,
) {
  let query = supabase
    .from(table)
    .select(columns)
    .eq("supplier_id", supplierId)
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (from) {
    query = query.gte("created_at", from.toISOString());
  }
  return query;
}

/**
 * Fetch sales analytics for the window plus the previous equal-length window
 * (skipped for lifetime — deltas are null there). Throws on query failure so
 * the page can render its error state.
 */
export async function getSalesAnalytics(
  supabase: SupabaseClient,
  supplierId: string,
  range: DashboardRange,
  now: Date = new Date(),
): Promise<SalesAnalytics> {
  const { from, to } = resolveRangeBounds(range, now);
  const spanMs = from ? Math.max(to.getTime() - from.getTime(), 0) : 0;
  const prevTo = from;
  const prevFrom = from && spanMs > 0 ? new Date(from.getTime() - spanMs) : null;
  const daysInWindow = Math.max(spanMs / DAY_MS, from ? 1 / 24 : 1);

  const ORDER_COLUMNS = "id, status, subtotal, buyer_id, region, created_at";
  const EVENT_COLUMNS = "session_id, event, source, buyer_id, created_at";

  const [currentOrdersRes, prevOrdersRes, currentEventsRes, buyerCountsRes] =
    await Promise.all([
      windowedQuery(supabase, "orders", ORDER_COLUMNS, supplierId, from, to, ORDERS_PAGE_SIZE),
      prevFrom && prevTo
        ? windowedQuery(supabase, "orders", ORDER_COLUMNS, supplierId, prevFrom, prevTo, ORDERS_PAGE_SIZE)
        : Promise.resolve({ data: [] as SalesOrderRow[], error: null }),
      windowedQuery(supabase, "storefront_events", EVENT_COLUMNS, supplierId, from, to, EVENTS_PAGE_SIZE),
      // All-time per-buyer counts to detect returning customers.
      supabase
        .from("orders")
        .select("buyer_id")
        .eq("supplier_id", supplierId)
        .limit(20000),
    ]);

  for (const [label, res] of [
    ["orders", currentOrdersRes],
    ["previous orders", prevOrdersRes],
    ["events", currentEventsRes],
    ["buyer counts", buyerCountsRes],
  ] as const) {
    if (res.error) throw new Error(`Sales analytics ${label} query failed: ${res.error.message}`);
  }

  const orders = (currentOrdersRes.data ?? []) as unknown as SalesOrderRow[];
  const prevOrders = (prevOrdersRes.data ?? []) as unknown as SalesOrderRow[];
  const events = ((currentEventsRes.data ?? []) as unknown as SalesEventRow[]).filter(
    (e) => e.event === "view" || e.event === "cart" || e.event === "order",
  );

  const summarize = (rows: SalesOrderRow[]) => ({
    count: rows.length,
    sales: rows.reduce((sum, o) => sum + o.subtotal, 0),
  });
  const cur = summarize(orders);
  const prev = summarize(prevOrders);

  const allTimeCounts = new Map<string, number>();
  for (const row of (buyerCountsRes.data ?? []) as { buyer_id: string }[]) {
    allTimeCounts.set(row.buyer_id, (allTimeCounts.get(row.buyer_id) ?? 0) + 1);
  }
  const returningIn = (rows: SalesOrderRow[]) => {
    const buyers = new Set(rows.map((o) => o.buyer_id));
    if (buyers.size === 0) return 0;
    let returning = 0;
    for (const buyer of buyers) {
      if ((allTimeCounts.get(buyer) ?? 0) > 1) returning += 1;
    }
    return Math.round((returning / buyers.size) * 1000) / 10;
  };
  const returningPct = returningIn(orders);
  const prevReturningPct = returningIn(prevOrders);

  const hasPrevious = prevFrom !== null;
  const avgOrdersPerDay = cur.count / daysInWindow;
  const prevAvgOrdersPerDay = prev.count / daysInWindow;
  const avgOrderValue = cur.count === 0 ? 0 : cur.sales / cur.count;
  const prevAvgOrderValue = prev.count === 0 ? 0 : prev.sales / prev.count;
  const avgSalesPerDay = cur.sales / daysInWindow;
  const prevAvgSalesPerDay = prev.sales / daysInWindow;

  // Category breakdown via this window's order items.
  let topCategories: ShareSlice[] = [];
  if (orders.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, quantity, unit_price, product:product_id(category_id)")
      .in(
        "order_id",
        orders.map((o) => o.id),
      )
      .limit(ORDERS_PAGE_SIZE);
    if (itemsError) throw new Error(`Sales analytics items query failed: ${itemsError.message}`);
    const items = (itemRows ?? []) as unknown as ItemRow[];
    const categoryIds = new Set<string>();
    for (const item of items) {
      const categoryId = itemCategoryId(item);
      if (categoryId) categoryIds.add(categoryId);
    }
    const names = new Map<string, string>();
    if (categoryIds.size > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", [...categoryIds]);
      if (categoriesError) throw new Error(`Sales analytics categories query failed: ${categoriesError.message}`);
      for (const category of (categories ?? []) as { id: string; name: string }[]) {
        names.set(category.id, category.name);
      }
    }
    const byCategory = new Map<string, number>();
    for (const item of items) {
      const categoryId = itemCategoryId(item);
      if (!categoryId) continue;
      const label = names.get(categoryId) ?? "Uncategorised";
      byCategory.set(label, (byCategory.get(label) ?? 0) + item.quantity * item.unit_price);
    }
    const total = [...byCategory.values()].reduce((sum, v) => sum + v, 0);
    topCategories = [...byCategory.entries()]
      .map(([label, sales]) => ({
        label,
        sales,
        sharePct: total === 0 ? 0 : Math.round((sales / total) * 1000) / 10,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);
  }

  // Regional breakdown from attributed orders.
  const byRegion = new Map<string, number>();
  for (const order of orders) {
    if (!order.region) continue;
    byRegion.set(order.region, (byRegion.get(order.region) ?? 0) + order.subtotal);
  }
  const regionTotal = [...byRegion.values()].reduce((sum, v) => sum + v, 0);
  const topRegions = [...byRegion.entries()]
    .map(([label, sales]) => ({
      label,
      sales,
      sharePct: regionTotal === 0 ? 0 : Math.round((sales / regionTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // Source breakdown: attribute each order's sales to its buyer's latest
  // order-event source at or before the order time.
  const orderEventsByBuyer = new Map<string, { source: string; at: number }[]>();
  for (const event of events) {
    if (event.event !== "order" || !event.source || !event.buyer_id) continue;
    const list = orderEventsByBuyer.get(event.buyer_id) ?? [];
    list.push({ source: event.source, at: new Date(event.created_at).getTime() });
    orderEventsByBuyer.set(event.buyer_id, list);
  }
  const bySource = new Map<string, number>();
  for (const order of orders) {
    const candidates = (orderEventsByBuyer.get(order.buyer_id) ?? []).filter(
      (c) => c.at <= new Date(order.created_at).getTime(),
    );
    if (candidates.length === 0) continue;
    const source = candidates.sort((a, b) => b.at - a.at)[0].source;
    bySource.set(source, (bySource.get(source) ?? 0) + order.subtotal);
  }
  const sourceTotal = [...bySource.values()].reduce((sum, v) => sum + v, 0);
  const SOURCE_LABELS: Record<string, string> = {
    direct: "Direct",
    search: "Search",
    social: "Social",
    referral: "Referral",
  };
  const topSources = [...bySource.entries()]
    .map(([key, sales]) => ({
      label: SOURCE_LABELS[key] ?? key,
      sales,
      sharePct: sourceTotal === 0 ? 0 : Math.round((sales / sourceTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.sales - a.sales);

  const series = buildTrendSeries({
    orders: orders.map((o) => ({ created_at: o.created_at, subtotal: o.subtotal })),
    events,
    from,
    to,
  });

  return {
    range,
    avgOrdersPerDay: {
      value: Math.round(avgOrdersPerDay * 10) / 10,
      changePct: hasPrevious ? changePct(avgOrdersPerDay, prevAvgOrdersPerDay) : null,
    },
    avgOrderValue: {
      value: Math.round(avgOrderValue),
      changePct: hasPrevious ? changePct(avgOrderValue, prevAvgOrderValue) : null,
    },
    avgSalesPerDay: {
      value: Math.round(avgSalesPerDay),
      changePct: hasPrevious ? changePct(avgSalesPerDay, prevAvgSalesPerDay) : null,
    },
    returningPct: {
      value: returningPct,
      changePct: hasPrevious ? changePct(returningPct, prevReturningPct) : null,
    },
    totalOrders: { value: cur.count, changePct: hasPrevious ? changePct(cur.count, prev.count) : null },
    grossSales: { value: cur.sales, changePct: hasPrevious ? changePct(cur.sales, prev.sales) : null },
    conversionPct: conversionOf(events),
    sessions: new Set(events.map((e) => e.session_id)).size,
    ordersSeries: series.map((p) => ({ label: p.label, orders: p.orders })),
    salesSeries: series.map((p) => ({ label: p.label, sales: p.sales })),
    conversionSeries: series.map((p) => ({ label: p.label, rate: p.conversion })),
    topRegions,
    topSources,
    topCategories,
  };
}
