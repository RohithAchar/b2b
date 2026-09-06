import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { BusinessProfileForm } from "./business-form";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

export default async function SupplierBusinessPage() {
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
      "business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, logo_path, kyb_status",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/supplier/onboarding");
  }

  const editable =
    company.kyb_status === "draft" || company.kyb_status === "rejected";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
          <CardDescription>
            Logo, company name and contact name — editable anytime, no
            re-verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessProfileForm
            businessName={company.business_name}
            contactPerson={company.contact_person}
            logoPath={company.logo_path}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification details</CardTitle>
          <CardDescription>
            Submitted for verification. These change only through a new
            application.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Contact & address</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Mobile" value={company.phone} />
              <Field
                label="City"
                value={company.city}
              />
            </div>
            <Field
              label="Registered address"
              value={
                company.address
                  ? `${company.address}, ${company.city}, ${company.state} ${company.pincode}`
                  : null
              }
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Tax IDs</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="GSTIN" value={company.gstin} />
              <Field label="PAN" value={company.pan} />
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Bank</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account number" value={company.bank_account} />
              <Field label="IFSC" value={company.bank_ifsc} />
            </div>
          </div>
          {editable ? (
            <>
              <Separator />
              <Button
                render={<Link href="/supplier/onboarding" />}
                nativeButton={false}
                className="w-full"
              >
                Edit full application
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
