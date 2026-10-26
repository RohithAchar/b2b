// Supplier product analytics: units-sold trend, top products by units and
// top categories by revenue share. Category percentages are revenue
// contribution (labeled on the page); product ranking is units sold.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DAY_MS,
  addBucket,
  bucketLabel,
  bucketStart,
  resolveRangeBounds,
  type ChartGranularity,
  type DashboardRange,
} from "@/lib/supplier/analytics";
import { latestAcceptedQuotation } from "@/lib/orders/quotation";
import { fetchAllRows } from "@/lib/supabase/fetch-all";

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
  const granularity: ChartGranularity =
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

type QuotationLink = {
  id: string;
  status: string;
  version: number;
  total: number;
};

type WindowOrderRow = {
  id: string;
  created_at: string;
  quotations?: QuotationLink[];
};

type ItemRow = {
  id: string;
  order_item_id?: string | null;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};

type QuoteLineRow = {
  order_item_id: string | null;
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

  const orders = await fetchAllRows<WindowOrderRow>(
    "Product analytics orders",
    (offset, limit) => {
      let query = supabase
        .from("orders")
        .select("id, created_at, quotations(id, status, version, total)")
        .eq("supplier_id", supplierId)
        .neq("status", "cancelled")
        .lt("created_at", to.toISOString())
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, limit);
      if (from) query = query.gte("created_at", from.toISOString());
      return query;
    },
  );

  const createdByOrder = new Map(orders.map((order) => [order.id, order.created_at]));
  const acceptedQuoteByOrder = new Map<string, string>();
  for (const order of orders) {
    const quote = latestAcceptedQuotation(order.quotations);
    if (quote) acceptedQuoteByOrder.set(order.id, quote.id);
  }

  let items = await fetchAllRows<ItemRow>(
    "Product analytics items",
    (offset, limit) =>
      supabase
        .from("order_items")
        .select("id, order_id, product_id, quantity, unit_price")
        .in(
          "order_id",
          orders.map((order) => order.id),
        )
        .order("id", { ascending: true })
        .range(offset, limit),
  );

  const acceptedQuoteIds = [...new Set(acceptedQuoteByOrder.values())];
  const quoteLines = new Map<string, QuoteLineRow>();
  if (acceptedQuoteIds.length > 0) {
    const rows = await fetchAllRows<QuoteLineRow & { quotation_id: string }>(
      "Product analytics agreed quotation lines",
      (offset, limit) =>
        supabase
          .from("quotation_items")
          .select("quotation_id, order_item_id, quantity, unit_price")
          .in("quotation_id", acceptedQuoteIds)
          .order("id", { ascending: true })
          .range(offset, limit),
    );
    for (const row of rows) {
      if (row.order_item_id) quoteLines.set(row.order_item_id, row);
    }
  }

  const effectiveItems: (ItemRow & { quantity: number; unit_price: number })[] = [];
  for (const item of items) {
    if (!createdByOrder.has(item.order_id)) continue;
    if (acceptedQuoteByOrder.has(item.order_id)) {
      const line = quoteLines.get(item.id);
      if (!line) continue;
      effectiveItems.push({
        ...item,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
      });
    } else {
      effectiveItems.push(item);
    }
  }
  items = effectiveItems;

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
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const products = await fetchAllRows<{
      id: string;
      title: string;
      category_id: string | null;
    }>(
      "Product analytics products",
      (offset, limit) =>
        supabase
          .from("products")
          .select("id, title, category_id")
          .in("id", productIds)
          .order("id", { ascending: true })
          .range(offset, limit),
    );
    const productMap = new Map(products.map((product) => [product.id, product]));

    const categoryIds = new Set(
      [...productMap.values()].map((p) => p.category_id).filter((id): id is string => !!id),
    );
    const names = new Map<string, string>();
    if (categoryIds.size > 0) {
      const categories = await fetchAllRows<{ id: string; name: string }>(
        "Product analytics categories",
        (offset, limit) =>
          supabase
            .from("categories")
            .select("id, name")
            .in("id", [...categoryIds])
            .order("id", { ascending: true })
            .range(offset, limit),
      );
      for (const category of categories) {
        names.set(category.id, category.name);
      }
    }

    const imageProductIds = ranked.map(([id]) => id);
    const images = new Map<string, string>();
    if (imageProductIds.length > 0) {
      const imageRows = await fetchAllRows<{ product_id: string; path: string }>(
        "Product analytics images",
        (offset, limit) =>
          supabase
            .from("product_images")
            .select("product_id, path, sort")
            .in("product_id", imageProductIds)
            .order("sort", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, limit),
      );
      for (const row of imageRows) {
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
