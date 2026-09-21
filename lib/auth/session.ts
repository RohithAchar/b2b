import type { createClient } from "@/lib/supabase/server";

export type SessionUser = { email: string; user_type: string } | null;

/**
 * Resolves the authenticated user + profile user_type for a request.
 * Returns null when signed out. Safe to run in parallel with public
 * storefront queries — the auth lookup is independent of catalog data.
 */
export async function getSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SessionUser> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  return {
    email: user.email ?? "",
    user_type: profile?.user_type ?? "buyer",
  };
}