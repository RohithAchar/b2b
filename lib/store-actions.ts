"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { resolveStore } from "@/lib/store-context";
import { STORE_COOKIE_NAME } from "@/lib/store-context-types";

/**
 * Server action: persist the customer's store selection in a cookie.
 *
 * The storeId is validated against the `stores` table (must exist and be
 * active) before the cookie is written — an inactive or unknown store can
 * never be selected. Not admin-restricted: any storefront visitor may select
 * among active stores.
 */
export async function setActiveStore(
  _prevState: { ok: boolean; message: string },
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const storeId = formData.get("storeId");
  if (typeof storeId !== "string" || !storeId) {
    return { ok: false, message: "No store selected." };
  }

  const supabase = await createClient();
  const store = await resolveStore(supabase, storeId);
  if (!store) {
    return { ok: false, message: "Store not found or inactive." };
  }

  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE_NAME, storeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return { ok: true, message: "" };
}
