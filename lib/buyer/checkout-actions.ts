"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { toDeliverySnapshot, type DeliverySnapshot } from "@/lib/orders/delivery";
import { queueAndDeliver } from "@/lib/notifications/order-notifications";
import { logStorefrontEvent } from "@/lib/storefront/events";

// Checkout: converts the buyer's cart into one order per supplier by calling
// the `create_orders_from_cart` RPC. Nothing about price, supplier or total
// is trusted from the browser — the RPC recomputes everything from canonical
// data, and this action only supplies the authenticated buyer, the validated
// address (loaded server-side from the buyer's own address book) and a
// client-generated idempotency key that makes retries safe.

export type CheckoutActionState = {
  ok: boolean;
  message: string;
  orderIds: string[];
};

const okState = (orderIds: string[], message = "Order placed."): CheckoutActionState => ({
  ok: true,
  message,
  orderIds,
});
const errState = (message: string): CheckoutActionState => ({
  ok: false,
  message,
  orderIds: [],
});

const placeOrderSchema = z.object({
  addressId: z.string().uuid("Choose a delivery address."),
  requestId: z.string().uuid("Missing checkout request id."),
  buyerNote: z.string().trim().max(500, "Keep the note under 500 characters.").optional(),
});

type AddressRow = {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  instructions: string | null;
};

/** Load the buyer's own address, or null. Never trusts a browser-supplied id. */
async function loadOwnAddress(
  supabase: SupabaseClient,
  buyerId: string,
  addressId: string,
): Promise<DeliverySnapshot | null> {
  const { data } = await supabase
    .from("buyer_addresses")
    .select(
      "id, full_name, phone, line1, line2, city, state, pincode, instructions",
    )
    .eq("id", addressId)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (!data) return null;
  const row = data as AddressRow;
  return toDeliverySnapshot({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    instructions: row.instructions,
    isDefault: false,
  });
}

export async function placeOrder(
  _prev: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = placeOrderSchema.safeParse({
    addressId: formData.get("addressId"),
    requestId: formData.get("requestId"),
    buyerNote: formData.get("buyerNote") || undefined,
  });
  if (!parsed.success) {
    return errState(
      parsed.error.issues[0]?.message ?? "Check the order details and try again.",
    );
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in to place an order.");
  }

  const delivery = await loadOwnAddress(supabase, user.id, parsed.data.addressId);
  if (!delivery) {
    return errState("Choose a valid delivery address from your saved addresses.");
  }

  const { data, error } = await supabase.rpc("create_orders_from_cart", {
    p_delivery: delivery,
    p_buyer_note: parsed.data.buyerNote ?? null,
    p_idempotency_key: parsed.data.requestId,
  });

  if (error) {
    // The RPC raises only our own user-facing messages (MOQ, minimum value,
    // availability); anything else is logged and answered generically so raw
    // database errors never reach the browser.
    console.error("placeOrder RPC failed:", error.code, error.message);
    const known = [
      "Minimum order quantity not met",
      "minimum order value",
      "no orderable items",
      "Delivery address",
      "Invalid phone",
      "Invalid PIN",
      "signed in",
      "Missing checkout",
    ].some((needle) => error.message.includes(needle));
    return errState(
      known
        ? error.message.replace(/^.*?:\s*/, "")
        : "Could not place your order. Your cart was not changed — try again.",
    );
  }

  const payload = data as {
    orders: { order_id: string }[];
    duplicate: boolean;
    skipped: number;
  };
  const orderIds = (payload?.orders ?? []).map((o) => o.order_id);
  if (orderIds.length === 0) {
    return errState("Your cart has no orderable items.");
  }

  // The RPC already cleared the ordered cart lines; refresh their views.
  revalidatePath("/cart");
  revalidatePath("/checkout");

  // Notification-only side channel: one alert per newly created order for
  // the supplier. Best-effort — the orders above are already committed and
  // survive any notification failure. A duplicate (idempotent) replay does
  // not re-alert anyone.
  if (!payload.duplicate) {
    for (const orderId of orderIds) {
      await queueAndDeliver(supabase, orderId, "new_order_supplier");
    }

    // Conversion is per session, so one event per order is correct: several
    // supplier orders in one checkout still count as one ordering session.
    // Analytics is best-effort and runs after the response is committed.
    const { data: orderRows } = await supabase
      .from("orders")
      .select("id, supplier_id")
      .in("id", orderIds);
    const suppliers = (orderRows ?? []) as { id: string; supplier_id: string }[];
    if (suppliers.length > 0) {
      after(() =>
        Promise.all(
          suppliers.map((order) =>
            logStorefrontEvent({
              supplierId: order.supplier_id,
              event: "order",
              buyerId: user.id,
            }),
          ),
        ),
      );
    }
  }

  return okState(
    orderIds,
    payload.skipped > 0
      ? "Order placed. Some unavailable items were left in your cart."
      : "Order placed.",
  );
}
