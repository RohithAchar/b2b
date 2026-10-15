// Append-only storefront analytics events (view / cart / order).
// Best-effort: logging never throws, so a failed insert can never break the
// buyer flow. Reads go through RLS (supplier-only) in lib/supplier/analytics.
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  STOREFRONT_DEVICE_COOKIE,
  STOREFRONT_SESSION_COOKIE,
  STOREFRONT_SOURCE_COOKIE,
  isDeviceClass,
  isTrafficSource,
  type DeviceClass,
  type TrafficSource,
} from "@/lib/storefront/session-cookie";

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

/** Acquisition bucket from the `b2b_src` cookie, or null when unset. */
export async function getStorefrontSource(): Promise<TrafficSource | null> {
  try {
    const store = await cookies();
    const source = store.get(STOREFRONT_SOURCE_COOKIE)?.value;
    return isTrafficSource(source) ? source : null;
  } catch {
    return null;
  }
}

/** Coarse device bucket from the `b2b_dev` cookie, or null when unset. */
export async function getStorefrontDevice(): Promise<DeviceClass | null> {
  try {
    const store = await cookies();
    const device = store.get(STOREFRONT_DEVICE_COOKIE)?.value;
    return isDeviceClass(device) ? device : null;
  } catch {
    return null;
  }
}

export async function logStorefrontEvent(input: {
  supplierId: string;
  productId?: string | null;
  sessionId?: string | null;
  event: StorefrontEventType;
  buyerId?: string | null;
  source?: TrafficSource | null;
  device?: DeviceClass | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    // One cookies() read serves all three fallbacks.
    const [source, device, sessionId] = await Promise.all([
      input.source ?? getStorefrontSource(),
      input.device ?? getStorefrontDevice(),
      input.sessionId ?? getStorefrontSessionId(),
    ]);
    const { error } = await supabase.from("storefront_events").insert({
      supplier_id: input.supplierId,
      product_id: input.productId ?? null,
      session_id: sessionId,
      event: input.event,
      source,
      device,
      buyer_id: input.buyerId ?? null,
    });
    if (error) {
      console.error("logStorefrontEvent failed:", error.code, error.message);
    }
  } catch (error) {
    console.error("logStorefrontEvent failed:", error);
  }
}
