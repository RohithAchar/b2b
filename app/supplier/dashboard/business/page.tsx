import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldSet, FieldLegend } from "@/components/ui/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { VerificationChecklistCard } from "@/components/dashboard/verification-checklist";
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
      "id, business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, logo_path, kyb_status",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/supplier/onboarding");
  }

  const editable =
    company.kyb_status === "draft" || company.kyb_status === "rejected";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="truncate text-xl font-bold tracking-tight">
            Business profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit company name, logo and contact here. Full application details are under Verification.
          </p>
        </div>
        <Button
          render={<Link href="/supplier/dashboard/verification" />}
          nativeButton={false}
          variant="outline"
          className="[&_svg]:size-3.5"
        >
          Verification
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 @lg/content:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="border-b border-border px-5 py-4">
            <CardTitle>Business profile</CardTitle>
            <CardDescription>
              Logo, company name and contact — changes here do not require re-verification.
            </CardDescription>
          </CardHeader>
          <div className="px-5 py-5">
            <BusinessProfileForm
              businessName={company.business_name}
              contactPerson={company.contact_person}
              logoPath={company.logo_path}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4 @lg/content:sticky @lg/content:top-4 @lg/content:self-start">
          <Card size="sm" className="!gap-0 !py-0">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle>Verification details</CardTitle>
              <CardDescription>
                Read-only unless you update the onboarding application.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 px-5 py-5">
              <FieldSet>
                <FieldLegend variant="label">Contact & address</FieldLegend>
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
              <Separator />
              <FieldSet>
                <FieldLegend variant="label">Tax IDs</FieldLegend>
                <ItemGroup>
                  <Detail label="GSTIN" value={company.gstin} />
                  <Detail label="PAN" value={company.pan} />
                </ItemGroup>
              </FieldSet>
              <Separator />
              <FieldSet>
                <FieldLegend variant="label">Bank</FieldLegend>
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
          <VerificationChecklistCard company={company} />
        </div>
      </div>
    </div>
  );
}