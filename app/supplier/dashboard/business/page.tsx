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
import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { BusinessProfileForm } from "./business-form";

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{value || "—"}</ItemTitle>
        <ItemDescription>{label}</ItemDescription>
      </ItemContent>
    </Item>
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="mb-2">
        <Button
          render={<Link href="/supplier/dashboard" />}
          nativeButton={false}
          variant="ghost"
        >
          Back to overview
        </Button>
      </div>
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
          <FieldSet>
            <FieldLegend>Contact & address</FieldLegend>
            <ItemGroup>
              <Detail label="Mobile" value={company.phone} />
              <Detail label="City" value={company.city} />
              <Detail
                label="Registered address"
                value={
                  company.address
                    ? `${company.address}, ${company.city}, ${company.state} ${company.pincode}`
                    : null
                }
              />
            </ItemGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend>Tax IDs</FieldLegend>
            <ItemGroup>
              <Detail label="GSTIN" value={company.gstin} />
              <Detail label="PAN" value={company.pan} />
            </ItemGroup>
          </FieldSet>
          <FieldSet>
            <FieldLegend>Bank</FieldLegend>
            <ItemGroup>
              <Detail label="Account number" value={company.bank_account} />
              <Detail label="IFSC" value={company.bank_ifsc} />
            </ItemGroup>
          </FieldSet>
          {editable ? (
            <Button
              render={<Link href="/supplier/onboarding" />}
              nativeButton={false}
            >
              Edit full application
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
