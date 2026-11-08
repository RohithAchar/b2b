import Link from "next/link";
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
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ count: supplierCount }, { count: pendingProducts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_type", "supplier"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 grid min-w-0 gap-0.5">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Supplier accounts and product listings.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 @lg/content:grid-cols-4">
        <KpiStat label="Total suppliers" value={supplierCount ?? 0} />
        <KpiStat label="Pending products" value={pendingProducts ?? 0} />
      </div>

      {(pendingProducts ?? 0) > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="grid min-w-0 gap-0.5">
                <CardTitle className="text-base font-medium">
                  Product moderation
                </CardTitle>
                <CardDescription className="text-xs">
                  {pendingProducts ?? 0} listing{pendingProducts === 1 ? "" : "s"} awaiting review.
                </CardDescription>
              </div>
              <Button
                render={<Link href="/admin/dashboard/products?tab=pending" />}
                nativeButton={false}
                variant="outline"
                size="sm"
                className="[&_svg]:size-3.5"
              >
                Review
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="size-3.5"
                />
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}