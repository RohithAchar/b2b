// Append-only storefront analytics events (view / cart / order).
// Best-effort: logging never throws, so a failed insert can never break the
// buyer flow. Reads go through RLS (supplier-only) in lib/supplier/analytics.
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { STOREFRONT_SESSION_COOKIE } from "@/lib/storefront/session-cookie";

export { STOREFRONT_SESSION_COOKIE };

export type StorefrontEventType = "view" | "cart" | "order";

/** Session id from the `b2b_sid` cookie, or a one-off id when unset. */
export async function getStorefrontSessionId(): Promise<string> {
  try {
    const store = await cookies();
    const sessionId = store.get(STOREFRONT_SESSION_COOKIE)?.value;
    if (sessionId) return sessionId;
  } catch {
    // Cookies unavailable (e.g. unit tests) — fall through to ephemeral id.
  }
  return `ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function logStorefrontEvent(input: {
  supplierId: string;
  productId?: string | null;
  sessionId?: string | null;
  event: StorefrontEventType;
  buyerId?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("storefront_events").insert({
      supplier_id: input.supplierId,
      product_id: input.productId ?? null,
      session_id: input.sessionId ?? (await getStorefrontSessionId()),
      event: input.event,
      buyer_id: input.buyerId ?? null,
    });
    if (error) {
      console.error("logStorefrontEvent failed:", error.code, error.message);
    }
  } catch (error) {
    console.error("logStorefrontEvent failed:", error);
  }
}
