"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { queueAndDeliver } from "@/lib/notifications/order-notifications";

// Buyer-side payment claim. The platform never handles money: the buyer pays
// the supplier directly, then records the UPI/UTR reference here. This only
// moves the order to `claimed`; the supplier must verify and confirm receipt
// before it becomes `paid`.

export type PaymentClaimState = {
  ok: boolean;
  message: string;
  reference?: string;
};

const claimSchema = z.object({
  orderId: z.string().uuid("Invalid order."),
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Enter the payment reference (at least 6 characters).")
    .max(30, "Keep the payment reference under 30 characters.")
    .regex(
      /^[A-Z0-9][A-Z0-9-]*$/,
      "Use letters, digits and dashes only (e.g. the UPI/UTR reference).",
    ),
});

/**
 * Record the buyer's claim, then alert the supplier. The claim is committed
 * first; a notification failure never affects it.
 */
export async function claimPayment(
  _prev: PaymentClaimState,
  formData: FormData,
): Promise<PaymentClaimState> {
  const parsed = claimSchema.safeParse({
    orderId: formData.get("orderId"),
    reference: formData.get("reference"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the payment reference.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in." };

  const { data, error } = await supabase.rpc("claim_order_payment", {
    p_order_id: parsed.data.orderId,
    p_reference: parsed.data.reference,
  });

  if (error) {
    console.error("claim_order_payment RPC failed:", error.code, error.message);
    const known = [
      "payment reference",
      "Order not found",
      "own order",
      "cancelled",
      "already recorded",
      "signed in",
      // Guard-trigger messages, surfaced so a rejected transition is never
      // hidden behind a generic "try again".
      "cannot move",
      "Only the supplier",
    ].some((needle) => error.message.includes(needle));
    return {
      ok: false,
      message: known
        ? error.message.replace(/^.*?:\s*/, "")
        : "Could not record your payment. Try again.",
    };
  }

  const payload = data as { reference?: string } | null;
  const reference = payload?.reference ?? parsed.data.reference;

  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderId}`);
  revalidatePath(`/orders/${parsed.data.orderId}/pay`);

  await queueAndDeliver(supabase, parsed.data.orderId, "payment_claimed_supplier");

  return {
    ok: true,
    reference,
    message:
      "Payment submitted. The supplier will verify it and confirm receipt — this does not mark the order paid automatically.",
  };
}
