// Order lifecycle domain rules: statuses, allowed transitions, and the
// actions each side may take. Kept dependency-free (no Supabase, no Next.js)
// so it unit-tests in isolation and can be imported from server actions,
// RPC-adjacent validation and UI components alike.
//
// These rules mirror the database guard trigger in
// supabase/migrations/20261021000000_order_lifecycle.sql — the trigger is the
// authority, this module keeps the UI and server actions honest about what is
// possible so users are never shown an action the database will reject.

/** Order statuses. `new` is "awaiting supplier review" (spec: pending_supplier). */
export const ORDER_STATUSES = [
  "new",
  "quoted",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Payment is tracked separately from order progress. Supplier-confirmed only. */
export const PAYMENT_STATUSES = ["not_requested", "pending", "paid"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Allowed order-status transitions (mirrors the DB guard trigger). */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["quoted", "confirmed", "cancelled"],
  quoted: ["new", "confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/** Allowed payment-status transitions (mirrors the DB guard trigger). */
export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  not_requested: ["pending", "paid"],
  pending: ["paid"],
  paid: [],
};

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_STATUS_TRANSITIONS[from].includes(to);
}

/** Explicit supplier actions — never a generic status dropdown. */
export const SUPPLIER_ORDER_ACTIONS = [
  "accept",
  "reject",
  "create_quotation",
  "mark_payment_pending",
  "mark_paid",
  "start_processing",
  "record_shipment",
  "mark_delivered",
] as const;

export type SupplierOrderAction = (typeof SUPPLIER_ORDER_ACTIONS)[number];

/**
 * Which supplier actions are valid for an order in the given statuses.
 * Payment actions are available on any live order (the supplier checks their
 * own bank/UPI whenever they like); progress actions follow the lifecycle.
 */
export function availableSupplierActions(
  status: OrderStatus,
): readonly SupplierOrderAction[] {
  const actions: SupplierOrderAction[] = [];
  if (status === "new" || status === "quoted") {
    actions.push("accept", "reject", "create_quotation");
  }
  if (status === "confirmed" || status === "processing") {
    actions.push("start_processing");
  }
  if (status === "processing") {
    actions.push("record_shipment");
  }
  if (status === "shipped") {
    actions.push("mark_delivered");
  }
  if (status !== "cancelled" && status !== "delivered") {
    actions.push("mark_payment_pending", "mark_paid");
  }
  return actions;
}

/** Buyer actions: quote review is only meaningful while a quote is pending. */
export function availableBuyerActions(status: OrderStatus): readonly ("accept_quotation" | "reject_quotation")[] {
  return status === "quoted" ? ["accept_quotation", "reject_quotation"] : [];
}

/** Human labels for statuses (buyer- and supplier-facing copy). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Awaiting supplier review",
  quoted: "Quotation sent",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  not_requested: "Not requested",
  pending: "Awaiting payment",
  paid: "Paid",
};

export function parseOrderStatus(raw: unknown): OrderStatus | null {
  return typeof raw === "string" && (ORDER_STATUSES as readonly string[]).includes(raw)
    ? (raw as OrderStatus)
    : null;
}

export function parsePaymentStatus(raw: unknown): PaymentStatus | null {
  return typeof raw === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as PaymentStatus)
    : null;
}
