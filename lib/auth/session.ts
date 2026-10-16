import type { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string; user_type: string; isStaff: boolean } | null;

/**
 * Resolves the authenticated user + profile user_type for a request.
 * Returns null when signed out. Safe to run in parallel with public
 * storefront queries — the auth lookup is independent of catalog data.
 * isStaff marks supplier staff (company_members row): they keep their own
 * account type but gain supplier-dashboard navigation.
 */
export async function getSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SessionUser> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    email: user.email ?? "",
    user_type: profile?.user_type ?? "buyer",
    isStaff: !!membership,
  };
}