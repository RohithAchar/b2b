import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { getSupplierContext } from "@/lib/auth/guard";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Supplier onboarding",
  description: "Create your supplier profile and activate your account.",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    redirect("/auth/login");
  }

  // Staff help manage someone else's business; they cannot onboard their
  // own company while staffing (keeps "my company" unambiguous).
  const ctx = await getSupplierContext(supabase, user.id);
  if (ctx?.role === "staff") {
    redirect("/supplier/dashboard");
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, logo_path, kyb_status",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  // Throwing rather than redirecting: a failed read would otherwise bounce.
  if (companyError) {
    console.error(
      "Supplier onboarding company query failed:",
      companyError.code,
      companyError.message,
    );
    throw companyError;
  }

  if (company) {
    redirect("/supplier/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <OnboardingForm
        title="Become a supplier"
        description="Fill in your business details to activate your supplier account."
        existing={null}
      />
    </div>
  );
}
