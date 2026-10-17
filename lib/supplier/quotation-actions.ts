"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSupplierContext } from "@/lib/auth/guard";
import { parseOrderStatus } from "@/lib/orders/lifecycle";
import {
  QUOTATION_MAX_MONEY,
  expiryToIso,
  quotationInputSchema,
} from "@/lib/orders/quotation";

// Supplier quotation actions. The form submits line prices (supplier-confirmed
// by nature) but never a total: `create_quotation` recomputes subtotal and
// total in SQL and rejects lines that don't match the actual order items.
// Ownership is re-checked here against the caller's company, never against a
// supplier id from the browser.

export type QuotationActionState = {
  ok: boolean;
  message: string;
  version?: number;
  total?: number;
};

const ok = (message: string, version?: number, total?: number): QuotationActionState => ({
  ok: true,
  message,
  version,
  total,
});
const err = (message: string): QuotationActionState => ({ ok: false, message });

const orderIdSchema = z.string().uuid("Invalid order.");

/**
 * Read the submitted form rows. Field names mirror the quote form:
 * orderItemId[] / quantity[] / unitPrice[] arrays plus scalar charge fields.
 */
function readQuotationForm(formData: FormData) {
  const orderItemIds = formData.getAll("orderItemId").map((v) => String(v));
  const quantities = formData.getAll("quantity").map((v) => String(v));
  const unitPrices = formData.getAll("unitPrice").map((v) => String(v));
  const rows = orderItemIds.map((orderItemId, index) => ({
    orderItemId,
    quantity: quantities[index] ?? "",
    unitPrice: unitPrices[index] ?? "",
  }));
  return {
    orderId: formData.get("orderId"),
    deliveryCharge: formData.get("deliveryCharge") || "0",
    taxAmount: formData.get("taxAmount") || "0",
    note: formData.get("note") || undefined,
    expiresOn: formData.get("expiresOn") || undefined,
    rows,
  };
}

export async function sendQuotation(
  _prev: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  const raw = readQuotationForm(formData);

  const parsedOrderId = orderIdSchema.safeParse(raw.orderId);
  if (!parsedOrderId.success) {
    return err("Invalid order.");
  }

  const parsed = quotationInputSchema.safeParse({
    lines: raw.rows,
    deliveryCharge: raw.deliveryCharge,
    taxAmount: raw.taxAmount,
    note: raw.note,
    expiresOn: raw.expiresOn,
  });
  if (!parsed.success) {
    return err(parsed.error.issues[0]?.message ?? "Check the quotation details.");
  }
  if (parsed.data.deliveryCharge > QUOTATION_MAX_MONEY) {
    return err("Delivery charge is too large.");
  }

  const expiresAt = expiryToIso(parsed.data.expiresOn);
  if (parsed.data.expiresOn && !expiresAt) {
    return err("Invalid expiry date.");
  }
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return err("Expiry must be in the future.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err("You must be signed in.");
  }

  // Ownership: the order must belong to the caller's company.
  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) {
    return err("You do not manage this order.");
  }
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", parsedOrderId.data)
    .eq("supplier_id", ctx.companyId)
    .maybeSingle();
  if (!order) {
    return err("Order not found.");
  }
  const status = parseOrderStatus((order as { status: string }).status);
  if (!status || (status !== "new" && status !== "quoted")) {
    return err("This order can no longer be quoted in its current state.");
  }

  const { data, error } = await supabase.rpc("create_quotation", {
    p_order_id: parsedOrderId.data,
    p_lines: parsed.data.lines.map((line) => ({
      order_item_id: line.orderItemId,
      quantity: line.quantity,
      unit_price: line.unitPrice,
    })),
    p_delivery_charge: parsed.data.deliveryCharge,
    p_tax_amount: parsed.data.taxAmount,
    p_note: parsed.data.note ?? null,
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error("sendQuotation RPC failed:", error.code, error.message);
    const known = [
      "quotation",
      "Quotation",
      "quantity",
      "Quantity",
      "price",
      "note",
      "Expiry",
      "Order",
      "order",
      "signed in",
    ].some((needle) => error.message.includes(needle));
    return err(
      known ? error.message.replace(/^.*?:\s*/, "") : "Could not save the quotation. Try again.",
    );
  }

  const payload = data as { version: number; total: number } | null;
  revalidatePath(`/supplier/dashboard/orders/${parsedOrderId.data}`);
  revalidatePath("/supplier/dashboard/orders");
  revalidatePath(`/orders/${parsedOrderId.data}`);
  return ok(
    payload ? `Quotation v${payload.version} sent to the buyer.` : "Quotation sent.",
    payload?.version,
    payload?.total,
  );
}
