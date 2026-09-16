import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { VerificationChecklistCard } from "@/components/dashboard/verification-checklist";

const KYB_HUMS: Record<string, { title: string; body: string }> = {
  draft: {
    title: "Start your verification",
    body: "Complete your business details, tax IDs, bank info and upload documents to start the review process. Most verifications complete in 1–3 business days.",
  },
  pending: {
    title: "Your application is under review",
    body: "Our compliance team is reviewing your business documents. You will receive an email once a decision is made — no action needed from you right now.",
  },
  verified: {
    title: "Your business is verified",
    body: "You can now list products and reach wholesale buyers across India.",
  },
  rejected: {
    title: "Your application needs changes",
    body: "Please review the notes below, update your details and resubmit. The quicker you fix, the faster you get approved.",
  },
};

export default async function SupplierVerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, gst_certificate_path, pan_card_path, license_path, kyb_status, rejection_note, submitted_at",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/supplier/onboarding");
  }

  const info = KYB_HUMS[company.kyb_status] ?? KYB_HUMS.draft;
  const editable = company.kyb_status === "draft" || company.kyb_status === "rejected";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Verification</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Application status
            <StatusBadge status="kyb" value={company.kyb_status} />
          </p>
        </div>
        {company.kyb_status === "draft" || company.kyb_status === "rejected" ? (
          <Button
            render={<Link href="/supplier/onboarding" />}
            nativeButton={false}
          >
            {editable ? (company.kyb_status === "draft" ? "Start application" : "Fix and resubmit") : null}
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        ) : null}
      </div>

      {company.rejection_note ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />
          <AlertTitle>Note from review team</AlertTitle>
          <AlertDescription>{company.rejection_note}</AlertDescription>
        </Alert>
      ) : null}

      <Alert variant="default">
        <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />
        <AlertTitle>{info.title}</AlertTitle>
        <AlertDescription>{info.body}</AlertDescription>
      </Alert>

      <VerificationChecklistCard company={company} />
    </div>
  );
}