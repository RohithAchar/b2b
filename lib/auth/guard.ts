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

export type SupplierRole = "owner" | "staff";

export type SupplierContext = {
  companyId: string;
  role: SupplierRole;
  verified: boolean;
};

/**
 * Single resolver for "my company": the owned company first, then a staffed
 * one. Every downstream query scopes by company id, so only this lookup
 * differs between owners and staff.
 */
export async function getSupplierContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<SupplierContext | null> {
  const { data: owned } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) {
    return {
      companyId: owned.id as string,
      role: "owner",
      verified: owned.kyb_status === "verified",
    };
  }
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;
  const { data: company } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("id", membership.company_id as string)
    .maybeSingle();
  if (!company) return null;
  return {
    companyId: company.id as string,
    role: "staff",
    verified: company.kyb_status === "verified",
  };
}

export async function getVerifiedSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const ctx = await getSupplierContext(supabase, userId);
  if (!ctx || !ctx.verified) return null;
  return ctx.companyId;
}

/**
 * Owner-only pages and actions (business profile, verification, margin,
 * team). Staff are sent back to the dashboard; strangers to onboarding.
 */
export async function requireOwnerCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const ctx = await getSupplierContext(supabase, userId);
  if (!ctx) redirect("/supplier/onboarding");
  if (ctx.role !== "owner") redirect("/supplier/dashboard");
  return ctx.companyId;
}