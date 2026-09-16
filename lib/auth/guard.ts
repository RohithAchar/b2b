import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";

export type AuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
};

export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  return { supabase, user: { id: user.id } };
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser();
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("user_type")
    .eq("id", ctx.user.id)
    .maybeSingle();

  if (profile?.user_type !== "admin") {
    redirect("/");
  }

  return ctx;
}

export async function getVerifiedSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data || data.kyb_status !== "verified") return null;
  return data.id as string;
}