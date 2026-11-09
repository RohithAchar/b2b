import { createClient } from "@/lib/supabase/server";

export type AccountStore = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

/**
 * Returns the stores the current account may access, resolved via the
 * account_stores membership table (one account → many stores). Returns an
 * empty array when the account has no linked stores.
 */
export async function getAccountStores(): Promise<AccountStore[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("account_stores")
    .select("store_id")
    .eq("profile_id", user.id);

  const storeIds = (data ?? []).map((row) => row.store_id);
  if (storeIds.length === 0) return [];

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .in("id", storeIds)
    .eq("status", "active")
    .order("name");

  return (stores ?? []) as AccountStore[];
}

/** Returns the ids of the stores the current account may access. */
export async function getAccountStoreIds(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("account_stores")
    .select("store_id")
    .eq("profile_id", user.id);

  return (data ?? []).map((row) => row.store_id);
}
