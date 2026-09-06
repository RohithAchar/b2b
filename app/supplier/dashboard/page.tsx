import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";

const STATUS: Record<
  string,
  {
    title: string;
    body: string;
    variant: "secondary" | "default" | "destructive" | "outline";
  }
> = {
  draft: {
    title: "Application not submitted",
    body: "Finish your application to start verification.",
    variant: "outline",
  },
  pending: {
    title: "Under review",
    body: "Your application is with our team. Selling unlocks once you are verified — no action needed from you right now.",
    variant: "secondary",
  },
  verified: {
    title: "Verified",
    body: "Your business is verified. Product tools are coming soon.",
    variant: "default",
  },
  rejected: {
    title: "Needs changes",
    body: "Your application needs changes before we can approve it.",
    variant: "destructive",
  },
};

function logoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${path}`;
}

export default async function SupplierOverviewPage() {
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
      "business_name, contact_person, city, state, kyb_status, rejection_note, logo_path, submitted_at",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/supplier/onboarding");
  }

  const status = STATUS[company.kyb_status] ?? STATUS.draft;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        {company.logo_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl(company.logo_path)}
            alt=""
            className="size-14 rounded-2xl border border-border object-cover"
          />
        ) : null}
        <div>
          <h1 className="text-xl font-medium">{company.business_name}</h1>
          <p className="text-sm text-muted-foreground">
            {company.contact_person} — {company.city}, {company.state}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <Badge variant={status.variant}>{status.title}</Badge>
          <CardDescription>{status.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {company.kyb_status === "rejected" && company.rejection_note ? (
            <p className="text-sm text-destructive">{company.rejection_note}</p>
          ) : null}
          <div className="flex gap-3">
            <Button
              render={<Link href="/supplier/dashboard/business" />}
              nativeButton={false}
              variant="outline"
            >
              View business profile
            </Button>
            {company.kyb_status === "rejected" ||
            company.kyb_status === "draft" ? (
              <Button
                render={<Link href="/supplier/onboarding" />}
                nativeButton={false}
              >
                {company.kyb_status === "rejected"
                  ? "Fix and resubmit"
                  : "Continue application"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What unlocks next</CardTitle>
          <CardDescription>
            Once verified you can list products, receive inquiries, and grow
            from here. We will update this page when each tool opens.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
