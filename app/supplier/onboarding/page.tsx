import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, gst_certificate_path, pan_card_path, license_path, logo_path, kyb_status",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  // Throwing rather than redirecting: a failed read would otherwise bounce
  // between this page and /supplier/status indefinitely.
  if (companyError) {
    console.error(
      "Supplier onboarding company query failed:",
      companyError.code,
      companyError.message,
    );
    throw companyError;
  }

  if (company?.kyb_status === "verified") {
    redirect("/supplier/status");
  }

  if (company?.kyb_status === "pending") {
    redirect("/supplier/status");
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <OnboardingForm
        title="Become a supplier"
        description={
          company?.kyb_status === "rejected"
            ? "Your application needs changes — update the details below and resubmit."
            : "Fill in your business details. We review every application before approval."
        }
        existing={company}
      />
    </div>
  );
}
