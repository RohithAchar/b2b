import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
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
import { CouponForm } from "@/components/dashboard/coupon-form";

export default async function NewCouponPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!company) {
    redirect("/supplier/onboarding");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, title")
    .eq("supplier_id", company.id)
    .order("title", { ascending: true })
    .limit(100);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create a coupon</h1>
          <p className="text-sm text-muted-foreground">
            New coupons start active and can be redeemed right away.
          </p>
        </div>
        <Button
          render={<Link href="/supplier/dashboard/discounts" />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Discounts
        </Button>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Coupon rules</CardTitle>
          <CardDescription>
            Eligibility (minimums, limits, expiry) is enforced at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CouponForm
            products={((products ?? []) as { id: string; title: string }[])}
          />
        </CardContent>
      </Card>
    </div>
  );
}
