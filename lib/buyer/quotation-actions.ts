"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Buyer response to a supplier quotation. The RPC verifies the caller owns
// the order, that this is the latest pending version, and that it hasn't
// expired. Accepting never marks anything paid — it only approves the quoted
// deal; the buyer then pays the supplier directly.

export type QuoteResponseState = {
  ok: boolean;
  message: string;
  status?: "accepted" | "rejected";
  total?: number;
};

const respondSchema = z.object({
  quotationId: z.string().uuid("Invalid quotation."),
  accept: z.enum(["yes", "no"]),
});

export async function respondToQuotation(
  _prev: QuoteResponseState,
  formData: FormData,
): Promise<QuoteResponseState> {
  const parsed = respondSchema.safeParse({
    quotationId: formData.get("quotationId"),
    accept: formData.get("accept"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid quotation response.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const { data, error } = await supabase.rpc("respond_to_quotation", {
    p_quotation_id: parsed.data.quotationId,
    p_accept: parsed.data.accept === "yes",
  });

  if (error) {
    console.error("respondToQuotation RPC failed:", error.code, error.message);
    const known = [
      "quotation",
      "Quotation",
      "order",
      "Order",
      "expired",
      "revised",
      "signed in",
      "response",
    ].some((needle) => error.message.includes(needle));
    return {
      ok: false,
      message: known
        ? error.message.replace(/^.*?:\s*/, "")
        : "Could not save your response. Try again.",
    };
  }

  const payload = data as {
    status: "accepted" | "rejected";
    total: number;
  };

  // The RPC changed order status, so refresh the buyer's order views.
  revalidatePath("/orders");
  revalidatePath(`/orders/${formData.get("orderId") ?? ""}`);

  if (payload.status === "accepted") {
    return {
      ok: true,
      status: "accepted",
      total: Number(payload.total),
      message:
        "Quotation accepted. Arrange payment directly with the supplier — this platform does not collect money.",
    };
  }
  return {
    ok: true,
    status: "rejected",
    message: "Quotation rejected. The order is back with the supplier for review.",
  };
}
