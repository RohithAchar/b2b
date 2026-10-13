// Supplier product analytics: units-sold trend, top products by units and
// top categories by revenue share. Category percentages are revenue
// contribution (labeled on the page); product ranking is units sold.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveRangeBounds,
  type DashboardRange,
} from "@/lib/supplier/analytics";

export type UnitsPoint = {
  key: string;
  label: string;
  units: number;
};

export type TopProduct = {
  productId: string;
  title: string;
  imagePath: string | null;
  units: number;
  revenue: number;
};

export type CategoryShare = {
  label: string;
  sales: number;
  sharePct: number;
};

export type ProductAnalytics = {
  range: DashboardRange;
  totalUnits: number;
  unitsSeries: { label: string; units: number }[];
  topProducts: TopProduct[];
  topCategories: CategoryShare[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ORDERS_PAGE_SIZE = 5000;
const ITEMS_PAGE_SIZE = 5000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

type Granularity = "hour" | "day" | "month";

function bucketStart(date: Date, granularity: Granularity): Date {
  if (granularity === "hour") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()));
  }
  if (granularity === "day") {
    return startOfUtcDay(date);
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function bucketLabel(start: Date, granularity: Granularity): string {
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

function addBucket(start: Date, granularity: Granularity, index: number): Date {
  const next = new Date(start.getTime());
  if (granularity === "hour") next.setUTCHours(next.getUTCHours() + index);
  else if (granularity === "day") next.setUTCDate(next.getUTCDate() + index);
  else next.setUTCMonth(next.getUTCMonth() + index);
  return next;
}

/**
 * Fold dated unit counts into a continuous series — every bucket appears,
 * even empty ones. Lifetime windows start at the earliest row.
 */
export function buildUnitsSeries(args: {
  rows: { created_at: string; quantity: number }[];
  from: Date | null;
  to: Date;
}): UnitsPoint[] {
  const { rows, to } = args;
  const times = rows
    .map((r) => new Date(r.created_at).getTime())
    .filter((t) => Number.isFinite(t) && t <= to.getTime());
  const windowStart = args.from ?? (times.length > 0 ? new Date(Math.min(...times)) : to);

  const spanMs = Math.max(to.getTime() - windowStart.getTime(), 0);
  const granularity: Granularity =
    spanMs <= 2 * DAY_MS ? "hour" : spanMs <= 120 * DAY_MS ? "day" : "month";

  const first = bucketStart(windowStart, granularity);
  const points: UnitsPoint[] = [];
  const indexByKey = new Map<string, UnitsPoint>();
  for (let i = 0; ; i++) {
    const start = addBucket(first, granularity, i);
    if (start.getTime() > to.getTime()) break;
    if (points.length >= 366) break;
    const key = start.toISOString();
    const point: UnitsPoint = { key, label: bucketLabel(start, granularity), units: 0 };
    points.push(point);
    indexByKey.set(key, point);
  }

  for (const row of rows) {
    const at = new Date(row.created_at);
    if (at < windowStart || at > to) continue;
    const point = indexByKey.get(bucketStart(at, granularity).toISOString());
    if (point) point.units += row.quantity;
  }
  return points;
}

type WindowOrderRow = { id: string; created_at: string };
type ItemRow = {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

const TOP_PRODUCTS_LIMIT = 6;
const TOP_CATEGORIES_LIMIT = 5;

/**
 * Fetch product analytics for the window. Throws on query failure so the
 * page can render its error state.
 */
export async function getProductAnalytics(
  supabase: SupabaseClient,
  supplierId: string,
  range: DashboardRange,
  now: Date = new Date(),
): Promise<ProductAnalytics> {
  const { from, to } = resolveRangeBounds(range, now);

  let ordersQuery = supabase
    .from("orders")
    .select("id, created_at")
    .eq("supplier_id", supplierId)
    .lt("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(ORDERS_PAGE_SIZE);
  if (from) {
    ordersQuery = ordersQuery.gte("created_at", from.toISOString());
  }
  const { data: orderRows, error: ordersError } = await ordersQuery;
  if (ordersError) throw new Error(`Product analytics orders query failed: ${ordersError.message}`);
  const orders = (orderRows ?? []) as unknown as WindowOrderRow[];

  let items: ItemRow[] = [];
  const createdByOrder = new Map(orders.map((o) => [o.id, o.created_at]));
  if (orders.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("order_items")
      .select("order_id, product_id, quantity, unit_price")
      .in(
        "order_id",
        orders.map((o) => o.id),
      )
      .limit(ITEMS_PAGE_SIZE);
    if (itemsError) throw new Error(`Product analytics items query failed: ${itemsError.message}`);
    items = (itemRows ?? []) as unknown as ItemRow[];
  }

  const byProduct = new Map<string, { units: number; revenue: number }>();
  const datedUnits: { created_at: string; quantity: number }[] = [];
  for (const item of items) {
    const createdAt = createdByOrder.get(item.order_id);
    if (!createdAt) continue;
    const entry = byProduct.get(item.product_id) ?? { units: 0, revenue: 0 };
    entry.units += item.quantity;
    entry.revenue += item.quantity * item.unit_price;
    byProduct.set(item.product_id, entry);
    datedUnits.push({ created_at: createdAt, quantity: item.quantity });
  }

  const ranked = [...byProduct.entries()]
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, TOP_PRODUCTS_LIMIT);

  let topProducts: TopProduct[] = [];
  let topCategories: CategoryShare[] = [];
  if (ranked.length > 0 || items.length > 0) {
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, title, category_id")
      .in("id", productIds);
    if (productsError) throw new Error(`Product analytics products query failed: ${productsError.message}`);
    const productMap = new Map(
      ((products ?? []) as { id: string; title: string; category_id: string | null }[]).map((p) => [p.id, p]),
    );

    const categoryIds = new Set(
      [...productMap.values()].map((p) => p.category_id).filter((id): id is string => !!id),
    );
    const names = new Map<string, string>();
    if (categoryIds.size > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", [...categoryIds]);
      if (categoriesError) {
        throw new Error(`Product analytics categories query failed: ${categoriesError.message}`);
      }
      for (const category of (categories ?? []) as { id: string; name: string }[]) {
        names.set(category.id, category.name);
      }
    }

    const imageProductIds = ranked.map(([id]) => id);
    const images = new Map<string, string>();
    if (imageProductIds.length > 0) {
      const { data: imageRows, error: imagesError } = await supabase
        .from("product_images")
        .select("product_id, path, sort")
        .in("product_id", imageProductIds)
        .order("sort", { ascending: true });
      if (imagesError) throw new Error(`Product analytics images query failed: ${imagesError.message}`);
      for (const row of (imageRows ?? []) as { product_id: string; path: string }[]) {
        if (!images.has(row.product_id)) images.set(row.product_id, row.path);
      }
    }

    topProducts = ranked.map(([productId, stats]) => ({
      productId,
      title: productMap.get(productId)?.title ?? "Unlisted product",
      imagePath: images.get(productId) ?? null,
      units: stats.units,
      revenue: stats.revenue,
    }));

    const categorySales = new Map<string, number>();
    for (const item of items) {
      const categoryId = productMap.get(item.product_id)?.category_id;
      if (!categoryId) continue;
      const label = names.get(categoryId) ?? "Uncategorised";
      categorySales.set(label, (categorySales.get(label) ?? 0) + item.quantity * item.unit_price);
    }
    const categoryTotal = [...categorySales.values()].reduce((sum, v) => sum + v, 0);
    topCategories = [...categorySales.entries()]
      .map(([label, sales]) => ({
        label,
        sales,
        sharePct: categoryTotal === 0 ? 0 : Math.round((sales / categoryTotal) * 1000) / 10,
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, TOP_CATEGORIES_LIMIT);
  }

  const series = buildUnitsSeries({ rows: datedUnits, from, to });

  return {
    range,
    totalUnits: datedUnits.reduce((sum, r) => sum + r.quantity, 0),
    unitsSeries: series.map((p) => ({ label: p.label, units: p.units })),
    topProducts,
    topCategories,
  };
}
