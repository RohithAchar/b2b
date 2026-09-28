import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { MarginForm } from "./margin-form";

export default async function SupplierMarginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, margin_pct")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Same distinction as app/supplier/dashboard/business/page.tsx: a failed read
  // must not be mistaken for a missing company.
  if (companyError) {
    console.error(
      "Supplier margin query failed:",
      companyError.code,
      companyError.message,
    );
    throw companyError;
  }

  if (!company) {
    redirect("/supplier/onboarding");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 grid min-w-0 gap-0.5">
        <h1 className="truncate text-xl font-bold tracking-tight">Margin</h1>
        <p className="text-sm text-muted-foreground">
          The markup added to your base price before buyers see it.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>Margin on base price</CardTitle>
          <CardDescription>
            One margin for your whole catalogue. Changing it here does not
            require re-verification.
          </CardDescription>
        </CardHeader>
        <div className="px-5 py-5">
          <MarginForm marginPct={Number(company.margin_pct ?? 0)} />
        </div>
      </Card>
    </div>
  );
}
