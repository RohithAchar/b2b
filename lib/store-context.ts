import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Cookie used to persist a customer's store selection across the storefront. */
export const STORE_COOKIE_NAME = "d2b_store";

export type ActiveStore = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

/**
 * Resolve the active store for the current request.
 *
 * Resolution order:
 * 1. Explicit `storeId` (from query param or cookie) — validated against the
 *    `stores` table. An unknown or inactive ID is rejected and never used.
 * 2. First active store in the database (fallback default).
 *
 * Returns null when no active store exists. Client-supplied IDs are always
 * validated — they can never grant access to an inactive or nonexistent store.
 */
export async function resolveStore(
  supabase: SupabaseServerClient,
  storeId?: string | null,
): Promise<ActiveStore | null> {
  if (storeId) {
    const { data } = await supabase
      .from("stores")
      .select("id, name, slug, status")
      .eq("id", storeId)
      .eq("status", "active")
      .maybeSingle();
    if (data) {
      return data as ActiveStore;
    }
    // Client-supplied ID is invalid (unknown or inactive). Fall through to the
    // default rather than using it — never trust the client.
  }

  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .eq("status", "active")
    .order("name")
    .limit(1)
    .maybeSingle();
  return (data ?? null) as ActiveStore | null;
}

/**
 * Require an active store for the current request. Throws when none is
 * available — callers should catch and redirect to a store-selection page or
 * render a "select a store" state.
 */
export async function requireActiveStore(
  supabase: SupabaseServerClient,
  storeId?: string | null,
): Promise<ActiveStore> {
  const store = await resolveStore(supabase, storeId);
  if (!store) {
    throw new Error("No active store available");
  }
  return store;
}

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
  "use server";
  const storeId = formData.get("storeId");
  if (typeof storeId !== "string" || !storeId) {
    return { ok: false, message: "No store selected." };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, status")
    .eq("id", storeId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) {
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
