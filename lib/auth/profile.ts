import { createClient } from "@/lib/supabase/server";

/**
 * Backstop for profile creation: the handle_new_user trigger is the primary
 * path, but this guarantees a row even for users created while the trigger
 * was absent. Idempotent; RLS permits self-insert.
 */
export async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return;
  }
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id" });
  if (error) {
    console.error("ensureProfile failed:", error);
  }
}
