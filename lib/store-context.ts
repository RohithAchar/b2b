import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

import type { ActiveStore } from "@/lib/store-context-types";
export type { ActiveStore } from "@/lib/store-context-types";

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
 * Public read of active stores for the storefront store selector.
 * No admin required — any visitor may see which stores are open.
 */
export async function getActiveStores(): Promise<ActiveStore[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .eq("status", "active")
    .order("name");
  return (data ?? []) as ActiveStore[];
}
