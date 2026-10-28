import { cache } from "react";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SessionUser = { id: string; email: string; user_type: string; isStaff: boolean } | null;

/**
 * Cached `auth.getUser()` for the current request. Layouts and pages that
 * only need identity share one network validation instead of calling
 * Supabase Auth twice per navigation.
 */
export const getAuthUser = cache(async (supabase: SupabaseServerClient) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
});

/**
 * Resolves the authenticated user + profile user_type for a request.
 * Returns null when signed out. Safe to run in parallel with public
 * storefront queries — the auth lookup is independent of catalog data.
 * isStaff marks supplier staff (company_members row): they keep their own
 * account type but gain supplier-dashboard navigation.
 *
 * Cached per request so a layout and the page inside it share one
 * `auth.getUser()` round trip plus one profile/membership lookup.
 */
export const getSessionUser = cache(async (
  supabase: SupabaseServerClient,
): Promise<SessionUser> => {
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email,
    user_type: profile?.user_type ?? "buyer",
    isStaff: !!membership,
  };
});