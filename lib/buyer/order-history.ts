// Buyer order history. Every query is scoped to the signed-in buyer (RLS
// enforces buyer_id = auth.uid() on orders; this helper just passes the
// session user explicitly for clarity). Supplier names come from the
// order_supplier_contact view — a SECURITY DEFINER view that only ever
// returns rows for the caller's own orders.

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOrderStatus, type OrderStatus } from "@/lib/orders/lifecycle";

export type BuyerOrderSummary = {
  id: string;
  reference: string;
  status: OrderStatus;
  /** Agreed total: accepted quotation total when one exists, else subtotal. */
  total: number;
  hasAcceptedQuote: boolean;
  itemCount: number;
  supplierName: string | null;
  buyerName: string | null;
  createdAt: string;
};

const HISTORY_PAGE_SIZE = 50;

type OrderRow = {
  id: string;
  reference: string;
  status: string;
  subtotal: number;
  item_count: number;
  delivery: { fullName?: string } | null;
  created_at: string;
};

/**
 * List the buyer's orders, newest first, decorated with the supplier's
 * business name and the accepted quotation total (if the buyer accepted one).
 */
export async function getBuyerOrders(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<BuyerOrderSummary[]> {
  const { data: orderRows, error } = await supabase
    .from("orders")
    .select(
      "id, reference, status, subtotal, item_count, delivery, created_at",
    )
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_PAGE_SIZE);
  if (error) {
    console.error("getBuyerOrders failed:", error.code, error.message);
    return [];
  }

  const orders = (orderRows ?? []) as unknown as OrderRow[];
  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);

  const [{ data: contactRows }, { data: quoteRows }] = await Promise.all([
    supabase
      .from("order_supplier_contact")
      .select("order_id, supplier_name")
      .in("order_id", orderIds),
    supabase
      .from("quotations")
      .select("order_id, total, status")
      .in("order_id", orderIds)
      .eq("status", "accepted"),
  ]);

  const supplierNames = new Map<string, string>();
  for (const row of (contactRows ?? []) as { order_id: string; supplier_name: string }[]) {
    supplierNames.set(row.order_id, row.supplier_name);
  }
  const acceptedTotals = new Map<string, number>();
  for (const row of (quoteRows ?? []) as { order_id: string; total: number }[]) {
    acceptedTotals.set(row.order_id, Number(row.total));
  }

  return orders.map((order) => {
    const acceptedTotal = acceptedTotals.get(order.id);
    return {
      id: order.id,
      reference: order.reference,
      status: parseOrderStatus(order.status) ?? "new",
      total: acceptedTotal ?? Number(order.subtotal),
      hasAcceptedQuote: acceptedTotal !== undefined,
      itemCount: order.item_count,
      supplierName: supplierNames.get(order.id) ?? null,
      buyerName: order.delivery?.fullName ?? null,
      createdAt: order.created_at,
    };
  });
}
