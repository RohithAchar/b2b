import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCartCoupons,
  getCartSummary,
  type CartSummaryResult,
} from "@/lib/buyer/cart-actions";
import { groupCartLinesBySupplier, type PricedCartLine } from "@/lib/buyer/cart";
import {
  describeCoupon,
  validateCouponForOrder,
  type CouponRule,
} from "@/lib/supplier/coupons";

export type CheckoutGroupCoupon = {
  code: string;
  description: string;
  discount: number;
};

export type CheckoutGroup = {
  supplierId: string;
  supplierName: string;
  lines: PricedCartLine[];
  subtotal: number;
  /** Coupon that applied at review time, or null when none/invalid. */
  coupon: CheckoutGroupCoupon | null;
  /** Why a saved code did not apply, so the buyer is not misled. */
  couponError: string | null;
  total: number;
};

export type CheckoutPreview = {
  groups: CheckoutGroup[];
  subtotal: number;
  savings: number;
  total: number;
  meetsMinimum: boolean;
  shortfall: number;
  unavailableCount: number;
};

const COUPON_RULE_COLUMNS =
  "id, code, type, is_active, percent_value, max_discount, flat_value, min_order_value, buy_quantity, get_quantity, free_product_id, loyalty_points, usage_limit, used_count, expires_at";

/**
 * The checkout review data: priced cart lines grouped by supplier, with every
 * saved coupon re-validated server-side against that supplier's group subtotal
 * — exactly the check the order-creation RPC repeats, so what the buyer
 * reviews is what the order will charge.
 */
export async function getCheckoutPreview(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<CheckoutPreview> {
  const [summary, savedCoupons]: [CartSummaryResult, Record<string, string>] =
    await Promise.all([
      getCartSummary(supabase, buyerId),
      getCartCoupons(supabase, buyerId).catch(() => ({}) as Record<string, string>),
    ]);

  const rawGroups = groupCartLinesBySupplier(summary.lines);

  // Re-validate every saved code in one round-trip instead of one query per
  // supplier group.
  const savedEntries = rawGroups.flatMap((group) => {
    const code = savedCoupons[group.supplierId];
    return code ? [{ supplierId: group.supplierId, code }] : [];
  });
  const couponByKey = new Map<string, CouponRule>();
  if (savedEntries.length > 0) {
    const { data: couponData } = await supabase
      .from("coupons")
      .select(`supplier_id, ${COUPON_RULE_COLUMNS}`)
      .in(
        "supplier_id",
        [...new Set(savedEntries.map((entry) => entry.supplierId))],
      )
      .in("code", [...new Set(savedEntries.map((entry) => entry.code))])
      .eq("is_active", true);
    for (const row of (couponData ?? []) as unknown as (CouponRule & {
      supplier_id: string;
    })[]) {
      couponByKey.set(`${row.supplier_id}:${row.code}`, row);
    }
  }

  const couponRows = rawGroups.map((group) => {
    const code = savedCoupons[group.supplierId];
    if (!code) return null;
    return couponByKey.get(`${group.supplierId}:${code}`) ?? null;
  });

  const groups: CheckoutGroup[] = rawGroups.map((group, index) => {
    let coupon: CheckoutGroupCoupon | null = null;
    let couponError: string | null = null;

    const rule = couponRows[index];
    const savedCode = savedCoupons[group.supplierId];
    if (savedCode) {
      if (!rule) {
        couponError = "This code is not valid for this store.";
      } else {
        const eligibility = validateCouponForOrder(rule, group.subtotal);
        if (!eligibility.ok) {
          couponError = eligibility.reason;
        } else if (eligibility.discount > 0) {
          coupon = {
            code: rule.code,
            description: describeCoupon(rule),
            discount: eligibility.discount,
          };
        }
      }
    }

    return {
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      lines: group.lines,
      subtotal: group.subtotal,
      coupon,
      couponError,
      total: group.subtotal - (coupon?.discount ?? 0),
    };
  });

  const savings = groups.reduce((sum, g) => sum + (g.coupon?.discount ?? 0), 0);

  return {
    groups,
    subtotal: summary.subtotal,
    savings,
    total: summary.subtotal - savings,
    meetsMinimum: summary.meetsMinimum,
    shortfall: summary.shortfall,
    unavailableCount: summary.unavailableCount,
  };
}

/** Fetch a buyer's own orders (with items and supplier names), for the
 * confirmation page. Ownership is enforced by the buyer_id scope + RLS. */
export async function getCheckoutOrders(
  supabase: SupabaseClient,
  buyerId: string,
  orderIds: string[],
): Promise<CheckoutOrderResult[]> {
  if (orderIds.length === 0) return [];

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, reference, status, subtotal, discount, item_count, created_at, supplier_id",
    )
    .eq("buyer_id", buyerId)
    .in("id", orderIds);

  const rows = (orders ?? []) as unknown as OrderResultRow[];
  if (rows.length === 0) return [];

  const supplierIds = [...new Set(rows.map((r) => r.supplier_id))];
  const [{ data: suppliers }, { data: items }] = await Promise.all([
    supabase
      .from("storefront_suppliers")
      .select("id, business_name")
      .in("id", supplierIds),
    supabase
      .from("order_items")
      .select("id, order_id, title, variant_label, unit, quantity, unit_price")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true }),
  ]);

  const supplierNames = new Map(
    ((suppliers ?? []) as { id: string; business_name: string }[]).map((s) => [
      s.id,
      s.business_name,
    ]),
  );
  const itemsByOrder = new Map<string, OrderResultItem[]>();
  for (const item of (items ?? []) as unknown as OrderResultItem[]) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  // Preserve the caller's order-id ordering for display.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return orderIds
    .map((id) => byId.get(id))
    .filter((order): order is OrderResultRow => Boolean(order))
    .map((order) => ({
      order,
      supplierName: supplierNames.get(order.supplier_id) ?? "Supplier",
      items: itemsByOrder.get(order.id) ?? [],
    }));
}

export type CheckoutOrderResult = {
  order: OrderResultRow;
  supplierName: string;
  items: OrderResultItem[];
};

export type OrderResultRow = {
  id: string;
  reference: string;
  status: string;
  subtotal: number;
  discount: number;
  item_count: number;
  created_at: string;
  supplier_id: string;
};

export type OrderResultItem = {
  id: string;
  order_id: string;
  title: string;
  variant_label: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
};
