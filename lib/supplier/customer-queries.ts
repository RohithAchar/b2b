// Supplier audience reads: enriched customer rows shared by the list page,
// the export route and the detail page. Classification and duplicate flags
// come from lib/supplier/customers.ts; order truth stays in orders.
import type { SupabaseClient } from "@supabase/supabase-js";
import { orderAmount } from "@/lib/orders/quotation";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import {
  classifyCustomer,
  type CustomerRow,
  type CustomerTab,
} from "@/lib/supplier/customers";

export type AudienceCustomer = CustomerRow & {
  orderCount: number;
  totalSales: number;
  category: Exclude<CustomerTab, "all">;
  duplicate: boolean;
};

const ROW_COLUMNS =
  "id, supplier_id, buyer_id, name, phone, email, city, source, created_at";

type CustomerOrderRow = {
  id: string;
  buyer_id: string;
  status: string;
  subtotal: number;
  created_at: string;
  quotations?: { status: string; version: number; total: number }[] | null;
};

async function buyerOrderStats(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<Map<string, { count: number; sales: number }>> {
  const orders = await fetchAllRows<CustomerOrderRow>(
    "Audience orders",
    (offset, limit) =>
      supabase
        .from("orders")
        .select("id, buyer_id, status, subtotal, created_at, quotations(status, version, total)")
        .eq("supplier_id", supplierId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .range(offset, limit),
  );
  const stats = new Map<string, { count: number; sales: number }>();
  for (const order of orders) {
    if (!order.buyer_id) continue;
    const entry = stats.get(order.buyer_id) ?? { count: 0, sales: 0 };
    entry.count += 1;
    entry.sales += orderAmount(order.subtotal, order.quotations);
    stats.set(order.buyer_id, entry);
  }
  return stats;
}

/**
 * All customers in the window (search-applied), enriched with order stats,
 * classification and duplicate flags. Callers filter/sort/paginate.
 */
export async function getAudienceCustomers(
  supabase: SupabaseClient,
  supplierId: string,
  opts: { q: string; from: Date | null; to: Date },
): Promise<AudienceCustomer[]> {
  const pattern = opts.q ? `%${opts.q}%` : null;
  const [rows, stats] = await Promise.all([
    fetchAllRows<CustomerRow>("Audience customers", (offset, limit) => {
      let query = supabase
        .from("store_customers")
        .select(ROW_COLUMNS)
        .eq("supplier_id", supplierId)
        .lt("created_at", opts.to.toISOString())
        .order("created_at", { ascending: false })
        .range(offset, limit);
      if (opts.from) {
        query = query.gte("created_at", opts.from.toISOString());
      }
      if (pattern) {
        query = query.or(
          `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`,
        );
      }
      return query;
    }),
    buyerOrderStats(supabase, supplierId),
  ]);

  const phoneFreq = new Map<string, number>();
  const emailFreq = new Map<string, number>();
  for (const row of rows) {
    phoneFreq.set(row.phone, (phoneFreq.get(row.phone) ?? 0) + 1);
    if (row.email) emailFreq.set(row.email.toLowerCase(), (emailFreq.get(row.email.toLowerCase()) ?? 0) + 1);
  }

  return rows.map((row) => {
    const stat = row.buyer_id ? (stats.get(row.buyer_id) ?? { count: 0, sales: 0 }) : { count: 0, sales: 0 };
    const duplicate =
      (phoneFreq.get(row.phone) ?? 0) > 1 ||
      (row.email ? (emailFreq.get(row.email.toLowerCase()) ?? 0) > 1 : false);
    return {
      ...row,
      orderCount: stat.count,
      totalSales: stat.sales,
      category: classifyCustomer(row.source, stat.count),
      duplicate,
    };
  });
}

export type CustomerDetail = {
  customer: CustomerRow;
  orderCount: number;
  totalSales: number;
  category: Exclude<CustomerTab, "all">;
  orders: {
    id: string;
    status: string;
    subtotal: number;
    created_at: string;
    quotations?: { status: string; version: number; total: number }[] | null;
  }[];
  activity: { event: string; productTitle: string | null; created_at: string }[];
};

/** Single customer with order history + recent storefront activity. */
export async function getCustomerDetail(
  supabase: SupabaseClient,
  supplierId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const { data: row, error } = await supabase
    .from("store_customers")
    .select(ROW_COLUMNS)
    .eq("supplier_id", supplierId)
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw new Error(`Audience customer query failed: ${error.message}`);
  if (!row) return null;
  const customer = row as CustomerRow;

  let orders: CustomerDetail["orders"] = [];
  let totalOrderCount = 0;
  let activity: CustomerDetail["activity"] = [];
  if (customer.buyer_id) {
    const [orderRows, { data: eventRows, error: eventsError }] = await Promise.all([
      fetchAllRows<CustomerDetail["orders"][number]>(
        "Audience customer orders",
        (offset, limit) =>
          supabase
            .from("orders")
            .select("id, status, subtotal, created_at, quotations(status, version, total)")
            .eq("supplier_id", supplierId)
            .eq("buyer_id", customer.buyer_id)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false })
            .range(offset, limit),
      ),
      supabase
        .from("storefront_events")
        .select("event, product_id, created_at")
        .eq("supplier_id", supplierId)
        .eq("buyer_id", customer.buyer_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (eventsError) throw new Error(`Audience activity query failed: ${eventsError.message}`);
    totalOrderCount = orderRows.length;
    orders = orderRows.slice(0, 50);
    const events = (eventRows ?? []) as { event: string; product_id: string | null; created_at: string }[];
    const productIds = [...new Set(events.map((e) => e.product_id).filter((id): id is string => !!id))];
    const titles = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: products } = await supabase.from("products").select("id, title").in("id", productIds);
      for (const product of (products ?? []) as { id: string; title: string }[]) {
        titles.set(product.id, product.title);
      }
    }
    activity = events.map((event) => ({
      event: event.event,
      productTitle: event.product_id ? (titles.get(event.product_id) ?? null) : null,
      created_at: event.created_at,
    }));
  }

  const totalSales = orders.reduce(
    (sum, order) => sum + orderAmount(order.subtotal, order.quotations),
    0,
  );
  return {
    customer,
    orderCount: totalOrderCount,
    totalSales,
    category: classifyCustomer(customer.source, totalOrderCount),
    orders,
    activity,
  };
}
