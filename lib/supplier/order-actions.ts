"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSupplierContext } from "@/lib/auth/guard";
import { queueAndDeliver } from "@/lib/notifications/order-notifications";
import {
  availableSupplierActions,
  parseOrderStatus,
  type SupplierOrderAction,
} from "@/lib/orders/lifecycle";

// Supplier order-management actions. Every action:
//   1. resolves the caller's company via getSupplierContext (owner or staff),
//   2. loads the order scoped to that company (ownership server-side, not RLS
//      alone and never a browser-supplied supplier id),
//   3. checks the requested action against the lifecycle rules, and
//   4. updates through the user's own session — the database guard trigger
//      enforces the transition matrix and stamps payment confirmation.

export type OrderActionResult = { ok: boolean; message: string };

const ok = (message: string): OrderActionResult => ({ ok: true, message });
const err = (message: string): OrderActionResult => ({ ok: false, message });

type SupplierOrderRow = {
  id: string;
  status: string;
  payment_status: string;
  supplier_id: string;
};

/**
 * Load an order only if it belongs to the caller's company. Returns null for
 * strangers, so a guessed order id can never leak or mutate anything.
 */
async function loadOwnOrder(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<SupplierOrderRow | null> {
  const ctx = await getSupplierContext(supabase, userId);
  if (!ctx) return null;
  const { data } = await supabase
    .from("orders")
    .select("id, status, payment_status, supplier_id")
    .eq("id", orderId)
    .eq("supplier_id", ctx.companyId)
    .maybeSingle();
  return (data as SupplierOrderRow | null) ?? null;
}

function refreshOrderPaths(orderId: string) {
  revalidatePath("/supplier/dashboard/orders");
  revalidatePath(`/supplier/dashboard/orders/${orderId}`);
}

const orderIdSchema = z.string().uuid("Invalid order.");

function canAct(order: SupplierOrderRow, action: SupplierOrderAction): boolean {
  const status = parseOrderStatus(order.status);
  return status !== null && availableSupplierActions(status).includes(action);
}

/** Accept: the supplier confirms the order (availability, price, delivery). */
export async function acceptOrder(orderId: string): Promise<OrderActionResult> {
  const parsedId = orderIdSchema.safeParse(orderId);
  if (!parsedId.success) return err("Invalid order.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const order = await loadOwnOrder(supabase, user.id, parsedId.data);
  if (!order) return err("Order not found.");
  if (!canAct(order, "accept")) {
    return err("This order can't be confirmed in its current state.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "confirmed" })
    .eq("id", order.id)
    .eq("supplier_id", order.supplier_id);
  if (error) {
    console.error("acceptOrder failed:", error.code, error.message);
    return err("Could not confirm the order. Try again.");
  }
  await queueAndDeliver(supabase, order.id, "order_confirmed_buyer");
  refreshOrderPaths(order.id);
  return ok("Order confirmed.");
}

const rejectionSchema = z.object({
  orderId: z.string().uuid("Invalid order."),
  reason: z
    .string()
    .trim()
    .min(5, "Give the buyer a short reason (at least 5 characters).")
    .max(500, "Keep the reason under 500 characters."),
});

/** Reject: the supplier declines; the reason is stored for the buyer. */
export async function rejectOrder(
  _prev: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  const parsed = rejectionSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the reason and try again.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const order = await loadOwnOrder(supabase, user.id, parsed.data.orderId);
  if (!order) return err("Order not found.");
  if (!canAct(order, "reject")) {
    return err("This order can't be rejected in its current state.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      rejection_reason: parsed.data.reason,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("supplier_id", order.supplier_id);
  if (error) {
    console.error("rejectOrder failed:", error.code, error.message);
    return err("Could not reject the order. Try again.");
  }
  await queueAndDeliver(supabase, order.id, "order_rejected_buyer");
  refreshOrderPaths(order.id);
  return ok("Order rejected. The buyer can see your reason.");
}

const paymentSchema = z.object({
  orderId: z.string().uuid("Invalid order."),
  paymentStatus: z.enum(["pending", "paid"]),
});

/**
 * Record payment state after checking the supplier's own bank/UPI. The
 * database stamps who confirmed and when; the platform never collects money.
 */
export async function setOrderPaymentStatus(
  _prev: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  const parsed = paymentSchema.safeParse({
    orderId: formData.get("orderId"),
    paymentStatus: formData.get("paymentStatus"),
  });
  if (!parsed.success) return err("Invalid payment update.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const order = await loadOwnOrder(supabase, user.id, parsed.data.orderId);
  if (!order) return err("Order not found.");

  const resolvingClaim = order.payment_status === "claimed";
  const action: SupplierOrderAction =
    parsed.data.paymentStatus === "paid"
      ? "mark_paid"
      : resolvingClaim
        ? "mark_payment_not_received"
        : "mark_payment_pending";
  if (!canAct(order, action)) {
    return err("Payment status can't be changed for this order.");
  }
  if (order.payment_status === parsed.data.paymentStatus) {
    return err("Payment status is already set to that.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ payment_status: parsed.data.paymentStatus })
    .eq("id", order.id)
    .eq("supplier_id", order.supplier_id);
  if (error) {
    console.error("setOrderPaymentStatus failed:", error.code, error.message);
    return err("Could not update payment status. Try again.");
  }
  if (parsed.data.paymentStatus === "paid") {
    await queueAndDeliver(supabase, order.id, "payment_confirmed_buyer");
  } else if (resolvingClaim) {
    await queueAndDeliver(supabase, order.id, "payment_not_received_buyer");
  }
  refreshOrderPaths(order.id);
  return ok(
    parsed.data.paymentStatus === "paid"
      ? "Payment received. Your confirmation is recorded."
      : resolvingClaim
        ? "Marked as not received. The buyer can submit the reference again."
        : "Marked as awaiting payment.",
  );
}

const statusSchema = z.object({
  orderId: z.string().uuid("Invalid order."),
  to: z.enum(["processing", "delivered"]),
});

/** Move a confirmed order forward: processing or delivered. */
export async function advanceOrderStatus(
  _prev: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  const parsed = statusSchema.safeParse({
    orderId: formData.get("orderId"),
    to: formData.get("to"),
  });
  if (!parsed.success) return err("Invalid status update.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const order = await loadOwnOrder(supabase, user.id, parsed.data.orderId);
  if (!order) return err("Order not found.");
  const action: SupplierOrderAction =
    parsed.data.to === "delivered" ? "mark_delivered" : "start_processing";
  if (!canAct(order, action)) {
    return err("This order can't move to that status.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.to })
    .eq("id", order.id)
    .eq("supplier_id", order.supplier_id);
  if (error) {
    console.error("advanceOrderStatus failed:", error.code, error.message);
    return err("Could not update the order. Try again.");
  }
  if (parsed.data.to === "delivered") {
    await queueAndDeliver(supabase, order.id, "order_delivered_buyer");
  }
  refreshOrderPaths(order.id);
  return ok(parsed.data.to === "delivered" ? "Marked as delivered." : "Order is processing.");
}

const shipmentSchema = z.object({
  orderId: z.string().uuid("Invalid order."),
  carrier: z.string().trim().max(120, "Keep the carrier name under 120 characters.").optional(),
  trackingRef: z.string().trim().max(80, "Keep the tracking reference under 80 characters.").optional(),
  shipmentNotes: z.string().trim().max(500, "Keep the notes under 500 characters.").optional(),
});

/** Ship: moves the order to shipped and records dispatch details. */
export async function recordShipment(
  _prev: OrderActionResult,
  formData: FormData,
): Promise<OrderActionResult> {
  const parsed = shipmentSchema.safeParse({
    orderId: formData.get("orderId"),
    carrier: formData.get("carrier") || undefined,
    trackingRef: formData.get("trackingRef") || undefined,
    shipmentNotes: formData.get("shipmentNotes") || undefined,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the shipment details.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const order = await loadOwnOrder(supabase, user.id, parsed.data.orderId);
  if (!order) return err("Order not found.");
  if (!canAct(order, "record_shipment")) {
    return err("This order can't be shipped in its current state.");
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "shipped",
      carrier: parsed.data.carrier || null,
      tracking_ref: parsed.data.trackingRef || null,
      shipment_notes: parsed.data.shipmentNotes || null,
    })
    .eq("id", order.id)
    .eq("supplier_id", order.supplier_id);
  if (error) {
    console.error("recordShipment failed:", error.code, error.message);
    return err("Could not record the shipment. Try again.");
  }
  await queueAndDeliver(supabase, order.id, "order_shipped_buyer");
  refreshOrderPaths(order.id);
  return ok("Shipment recorded. The buyer can see the tracking details.");
}
