// Supplier audience reads: enriched customer rows shared by the list page,
// the export route and the detail page. Classification and duplicate flags
// come from lib/supplier/customers.ts; order truth stays in orders.
import type { SupabaseClient } from "@supabase/supabase-js";
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

async function buyerOrderStats(
  supabase: SupabaseClient,
  supplierId: string,
): Promise<Map<string, { count: number; sales: number }>> {
  const { data, error } = await supabase
    .from("orders")
    .select("buyer_id, subtotal")
    .eq("supplier_id", supplierId)
    .limit(5000);
  if (error) throw new Error(`Audience orders query failed: ${error.message}`);
  const stats = new Map<string, { count: number; sales: number }>();
  for (const order of (data ?? []) as { buyer_id: string; subtotal: number }[]) {
    const entry = stats.get(order.buyer_id) ?? { count: 0, sales: 0 };
    entry.count += 1;
    entry.sales += order.subtotal;
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
  let query = supabase
    .from("store_customers")
    .select(ROW_COLUMNS)
    .eq("supplier_id", supplierId)
    .lt("created_at", opts.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(1000);
  if (opts.from) {
    query = query.gte("created_at", opts.from.toISOString());
  }
  if (opts.q) {
    const pattern = `%${opts.q}%`;
    query = query.or(
      `name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern},city.ilike.${pattern}`,
    );
  }
  const [{ data, error }, stats] = await Promise.all([
    query,
    buyerOrderStats(supabase, supplierId),
  ]);
  if (error) throw new Error(`Audience customers query failed: ${error.message}`);
  const rows = (data ?? []) as CustomerRow[];

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
  orders: { id: string; status: string; subtotal: number; created_at: string }[];
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
  let activity: CustomerDetail["activity"] = [];
  if (customer.buyer_id) {
    const [{ data: orderRows, error: ordersError }, { data: eventRows, error: eventsError }] =
      await Promise.all([
        supabase
          .from("orders")
          .select("id, status, subtotal, created_at")
          .eq("supplier_id", supplierId)
          .eq("buyer_id", customer.buyer_id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("storefront_events")
          .select("event, product_id, created_at")
          .eq("supplier_id", supplierId)
          .eq("buyer_id", customer.buyer_id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
    if (ordersError) throw new Error(`Audience orders query failed: ${ordersError.message}`);
    if (eventsError) throw new Error(`Audience activity query failed: ${eventsError.message}`);
    orders = (orderRows ?? []) as CustomerDetail["orders"];
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

  const totalSales = orders.reduce((sum, o) => sum + o.subtotal, 0);
  return {
    customer,
    orderCount: orders.length,
    totalSales,
    category: classifyCustomer(customer.source, orders.length),
    orders,
    activity,
  };
}
