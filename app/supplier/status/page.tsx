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
import { createClient } from "@/lib/supabase/server";

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Under review",
    body: "Your application is with our team. We will update you once it is verified.",
  },
  verified: {
    title: "Verified",
    body: "Your business is verified. Seller tools are coming soon.",
  },
  rejected: {
    title: "Needs changes",
    body: "Your application needs changes before we can approve it.",
  },
  draft: {
    title: "Not submitted",
    body: "You have not submitted your application yet.",
  },
};

export default async function SupplierStatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("business_name, kyb_status, rejection_note")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Throwing rather than redirecting: on a failed read this page and
  // /supplier/onboarding would bounce off each other forever.
  if (companyError) {
    console.error(
      "Supplier status company query failed:",
      companyError.code,
      companyError.message,
    );
    throw companyError;
  }

  if (!company) {
    redirect("/supplier/onboarding");
  }

  const copy = STATUS_COPY[company.kyb_status] ?? STATUS_COPY.draft;
  const editable =
    company.kyb_status === "draft" || company.kyb_status === "rejected";

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>
            {company.business_name} — {copy.body}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {company.kyb_status === "rejected" && company.rejection_note ? (
            <p className="text-sm text-destructive">{company.rejection_note}</p>
          ) : null}
          {editable ? (
            <Button
              render={<Link href="/supplier/onboarding" />}
              nativeButton={false}
              className="w-full"
            >
              {company.kyb_status === "rejected"
                ? "Fix and resubmit"
                : "Continue application"}
            </Button>
          ) : null}
          <Button
            render={<Link href="/supplier/dashboard" />}
            nativeButton={false}
            variant="outline"
            className="w-full"
          >
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
