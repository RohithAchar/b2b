"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Server action: link the current account to every active store (the single
 * onboarding flow for all 4 stores). Idempotent — re-running is a no-op for
 * stores already linked. Promotes the account to supplier on success.
 */
export async function linkAccountToAllStores(): Promise<{
  ok: boolean;
  message: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Not signed in." };
  }

  // Linking stores makes this account a supplier.
  await supabase
    .from("profiles")
    .update({ user_type: "supplier" })
    .eq("id", user.id)
    .eq("user_type", "buyer");

  const { data: stores } = await supabase
    .from("stores")
    .select("id")
    .eq("status", "active");

  const storeIds = (stores ?? []).map((s) => s.id);
  if (storeIds.length === 0) {
    return { ok: false, message: "No active stores to link." };
  }

  const rows = storeIds.map((storeId) => ({
    profile_id: user.id,
    store_id: storeId,
  }));

  const { error } = await supabase.from("account_stores").insert(rows);

  if (error) {
    // Unique violation on re-link is fine — the account already has access.
    if (error.code === "23505") {
      return { ok: true, message: "" };
    }
    console.error("linkAccountToAllStores failed:", error);
    return { ok: false, message: "Could not link stores. Try again." };
  }

  return { ok: true, message: "" };
}
