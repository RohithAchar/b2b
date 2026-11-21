import "server-only";
import { formatRupees } from "@/lib/format";
import { sendWhatsAppMessage } from "./whatsapp";

/**
 * WhatsApp alert to the D2B team when a buyer places an order, so someone can
 * call the buyer ("our team will contact you soon"). Goes to ORDER_ALERT_WHATSAPP,
 * an internal team number (never a supplier or another buyer), which is why
 * it carries the buyer's name and phone. The delivery address is never
 * included. Best-effort: a failed send never affects the order.
 */

export type TeamOrderAlert = {
  buyerName: string;
  buyerPhone: string;
  orders: { reference: string; supplierName: string; total: number }[];
};

/** Message text. Pure, so it is unit-tested. Totals include GST. */
export function teamOrderAlertText({ buyerName, buyerPhone, orders }: TeamOrderAlert): string {
  const lines = orders.map((o) => `• ${o.reference} (${o.supplierName}) ${formatRupees(o.total)}`);
  const grand = Math.round(orders.reduce((sum, o) => sum + o.total, 0) * 100) / 100;
  return [
    `New order on D2B: ${orders.length} order${orders.length === 1 ? "" : "s"}, ${formatRupees(grand)} incl. GST`,
    ...lines,
    `Buyer: ${buyerName}, ${buyerPhone}`,
    "Please contact the buyer to confirm.",
  ].join("\n");
}

/** Send the alert if ORDER_ALERT_WHATSAPP is set. Never throws. */
export async function sendTeamOrderAlert(alert: TeamOrderAlert): Promise<void> {
  const to = process.env.ORDER_ALERT_WHATSAPP?.trim();
  if (!to || alert.orders.length === 0) return;
  try {
    const result = await sendWhatsAppMessage(to, teamOrderAlertText(alert));
    if (!result.ok) console.error("Team order alert not sent:", result.error);
  } catch (error) {
    console.error("Team order alert failed:", error);
  }
}
