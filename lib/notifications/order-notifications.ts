// Order notification pipeline: queue -> attempt delivery -> record the
// provider's confirmed result in notification_outbox.
//
// Two hard rules live here:
//   1. Messages carry only business facts (reference, agreed total, tracking)
//      and a secure link to the order page — never the delivery address, the
//      buyer's phone, or anything the recipient isn't allowed to read. The
//      link itself is just /orders/{uuid}; the pages behind it enforce auth
//      and ownership, so a leaked link leaks nothing.
//   2. Notification failure never affects the order. Every call below
//      swallows its own errors; the business mutation has already committed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { SITE_URL } from "@/lib/site";
import { formatRupees } from "@/lib/format";
import { sendWhatsAppMessage } from "./whatsapp";

export type NotificationTemplate =
  | "new_order_supplier"
  | "quotation_sent_buyer"
  | "quotation_accepted_supplier"
  | "quotation_rejected_supplier"
  | "order_confirmed_buyer"
  | "order_rejected_buyer"
  | "order_shipped_buyer"
  | "order_delivered_buyer"
  | "payment_confirmed_buyer"
  | "payment_claimed_supplier"
  | "payment_not_received_buyer";

/** Only non-address facts — mirrors what queue_order_notification stores. */
export type NotificationPayload = {
  reference?: string;
  buyer_name?: string;
  total?: number;
  version?: number;
  reason?: string;
  carrier?: string | null;
  tracking_ref?: string | null;
  payment_reference?: string | null;
};

const buyerUrl = (orderId: string) => `${SITE_URL}/orders/${orderId}`;
const supplierUrl = (orderId: string) =>
  `${SITE_URL}/supplier/dashboard/orders/${orderId}`;

/**
 * Build the message text for a template. Returns null for unknown templates
 * (nothing is sent). Pure — unit-tested to prove no address or phone ever
 * appears.
 */
export function notificationText(
  template: NotificationTemplate,
  orderId: string,
  payload: NotificationPayload,
): string | null {
  const ref = payload.reference ?? "";
  switch (template) {
    case "new_order_supplier":
      return `New order ${ref} from ${payload.buyer_name ?? "a buyer"} — ${formatRupees(payload.total ?? 0)}. Review it: ${supplierUrl(orderId)}`;
    case "quotation_sent_buyer":
      return `Your supplier sent quotation v${payload.version} for order ${ref} (${formatRupees(payload.total ?? 0)}). Review and respond: ${buyerUrl(orderId)}`;
    case "quotation_accepted_supplier":
      return `The buyer accepted quotation v${payload.version} for order ${ref} (${formatRupees(payload.total ?? 0)}). Arrange delivery: ${supplierUrl(orderId)}`;
    case "quotation_rejected_supplier":
      return `The buyer declined quotation v${payload.version} for order ${ref}. Send a revised quote: ${supplierUrl(orderId)}`;
    case "order_confirmed_buyer":
      return `Order ${ref} is confirmed by the supplier. Track it: ${buyerUrl(orderId)}`;
    case "order_rejected_buyer":
      return `Order ${ref} was cancelled: ${payload.reason ?? "contact the supplier"}. Details: ${buyerUrl(orderId)}`;
    case "order_shipped_buyer":
      return `Order ${ref} shipped${payload.carrier ? ` via ${payload.carrier}` : ""}${payload.tracking_ref ? ` (${payload.tracking_ref})` : ""}. Track it: ${buyerUrl(orderId)}`;
    case "order_delivered_buyer":
      return `Order ${ref} is marked delivered. Details: ${buyerUrl(orderId)}`;
    case "payment_confirmed_buyer":
      return `The supplier confirmed payment received for order ${ref}. Details: ${buyerUrl(orderId)}`;
    case "payment_claimed_supplier":
      return `The buyer says they paid ${formatRupees(payload.total ?? 0)} for order ${ref}${payload.payment_reference ? ` (ref ${payload.payment_reference})` : ""}. Verify and confirm: ${supplierUrl(orderId)}`;
    case "payment_not_received_buyer":
      return `The supplier could not find your payment for order ${ref}. Check the reference or submit it again: ${buyerUrl(orderId)}`;
    default:
      return null;
  }
}

export const NOTIFICATION_LABELS: Record<NotificationTemplate, string> = {
  new_order_supplier: "New order alert",
  quotation_sent_buyer: "Quotation sent",
  quotation_accepted_supplier: "Quotation accepted",
  quotation_rejected_supplier: "Quotation declined",
  order_confirmed_buyer: "Order confirmed",
  order_rejected_buyer: "Order cancelled",
  order_shipped_buyer: "Order shipped",
  order_delivered_buyer: "Order delivered",
  payment_confirmed_buyer: "Payment confirmed",
  payment_claimed_supplier: "Payment submitted",
  payment_not_received_buyer: "Payment not received",
};

/**
 * Queue one notification for an order and hand delivery to the background.
 *
 * The queue insert stays inline so the row is durable before the response
 * (a crash mid-send leaves a recoverable `pending` row). The send itself is
 * deferred with `after()`: OpenWA can block for many seconds on its cold path,
 * and the buyer's checkout response must never wait on it.
 */
export async function queueAndDeliver(
  supabase: SupabaseClient,
  orderId: string,
  template: NotificationTemplate,
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("queue_order_notification", {
      p_order_id: orderId,
      p_template: template,
    });
    if (error || !data) {
      console.error("queue_order_notification failed:", error?.code, error?.message);
      return;
    }
    const outboxId = data as string;
    after(() => deliverNotification(supabase, outboxId));
  } catch (error) {
    console.error("queueAndDeliver failed:", error);
  }
}

/**
 * Attempt delivery of one queued row and record only what the provider
 * confirmed. Rows stay "pending" if the process dies before this returns —
 * a later sweep can retry them; nothing else depends on them.
 */
export async function deliverNotification(
  supabase: SupabaseClient,
  outboxId: string,
): Promise<void> {
  try {
    // RLS scopes this read to the caller's own notifications; the queueing
    // party is always the order's buyer or supplier side.
    const { data: row } = await supabase
      .from("notification_outbox")
      .select("id, order_id, template, recipient_phone, payload, status, attempts")
      .eq("id", outboxId)
      .maybeSingle();
    if (!row || row.status !== "pending") return;

    const template = row.template as NotificationTemplate;
    const text = notificationText(
      template,
      row.order_id as string,
      row.payload as NotificationPayload,
    );

    const attemptedAt = new Date().toISOString();
    const attempts = (row.attempts as number | null ?? 0) + 1;

    const finish = (update: Record<string, unknown>) =>
      supabase
        .from("notification_outbox")
        .update({
          ...update,
          attempts,
          last_attempt_at: attemptedAt,
        })
        .eq("id", outboxId)
        .eq("status", "pending");

    if (!text) {
      await finish({ status: "failed", error: "Unknown notification template." });
      return;
    }
    if (!row.recipient_phone) {
      await finish({ status: "failed", error: "No recipient number on file." });
      return;
    }

    const result = await sendWhatsAppMessage(row.recipient_phone as string, text);
    if (result.ok) {
      await finish({
        status: "sent",
        provider: result.provider,
        provider_message_id: result.messageId,
        error: null,
      });
    } else {
      await finish({ status: "failed", provider: result.provider, error: result.error });
    }
  } catch (error) {
    console.error("deliverNotification failed:", error);
  }
}
