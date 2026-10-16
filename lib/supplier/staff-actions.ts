"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireOwnerCompany } from "@/lib/auth/guard";

export type StaffActionState = {
  ok: boolean;
  message: string;
  field?: "email";
};

const errState = (message: string, field?: "email"): StaffActionState => ({
  ok: false,
  message,
  field,
});

type StaffCandidate = {
  user_id: string;
  user_type: string;
  owns_company_id: string | null;
  email: string | null;
};

const TEAM_PATH = "/supplier/dashboard/team";

/**
 * Add a staffer by email. Owner-only (page + RLS enforce it too).
 * The account must already exist and must not own a business — access is
 * linked by user_id, so later email changes never break it. A buyer account
 * is promoted to supplier lazily on its first dashboard visit (layout).
 */
export async function addStaff(
  _prevState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const { supabase, user } = await requireUser();
  const companyId = await requireOwnerCompany(supabase, user.id);

  const email = (formData.get("email")?.toString() ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errState("Enter a valid email address.", "email");
  }

  // Resolved over RPC: owners cannot read other users' profiles rows
  // through RLS, so the public.staff_candidate wrapper (owner-derived
  // company, SECURITY DEFINER) performs the lookup.
  const { data: rows, error: lookupError } = await supabase.rpc("staff_candidate", {
    p_email: email,
  });
  if (lookupError) {
    console.error("addStaff lookup failed:", lookupError.code, lookupError.message);
    return errState("Could not look up that email. Try again.");
  }
  const candidate = ((rows ?? []) as StaffCandidate[])[0];
  if (!candidate) {
    return errState(
      "No account found with this email. Ask them to sign up first, then add them again.",
      "email",
    );
  }
  if (candidate.user_id === user.id) {
    return errState("That's your own email — you're already the owner.", "email");
  }
  if (candidate.owns_company_id) {
    return errState(
      "This account already owns a business, so it can't join as staff.",
      "email",
    );
  }
  if (candidate.user_type !== "supplier" && candidate.user_type !== "buyer") {
    return errState("This account can't be added as staff.", "email");
  }

  const { error: insertError } = await supabase.from("company_members").insert({
    company_id: companyId,
    user_id: candidate.user_id,
    email: candidate.email ?? email,
    invited_by: user.id,
  });
  if (insertError) {
    // Already a member: unique(company_id, user_id).
    if (insertError.code === "23505") {
      return errState("This person is already on your team.", "email");
    }
    console.error("addStaff insert failed:", insertError.code, insertError.message);
    return errState("Could not add this person. Try again.");
  }

  revalidatePath(TEAM_PATH);
  return { ok: true, message: "Added to your team. They'll see your business on their next visit." };
}

/** Revoke a staffer. Owner-only; access ends immediately. */
export async function removeStaff(memberId: string): Promise<StaffActionState> {
  const { supabase, user } = await requireUser();
  const companyId = await requireOwnerCompany(supabase, user.id);

  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("id", memberId)
    .eq("company_id", companyId);
  if (error) {
    console.error("removeStaff failed:", error.code, error.message);
    return errState("Could not remove this person. Try again.");
  }

  revalidatePath(TEAM_PATH);
  return { ok: true, message: "Removed from your team." };
}
