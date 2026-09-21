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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { createClient } from "@/lib/supabase/server";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: pendingCount },
    { count: verifiedCount },
    { count: rejectedCount },
    { count: supplierCount },
    { count: pendingProducts },
    { data: waiting },
    { data: recentDecisions },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("kyb_status", "pending"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("kyb_status", "verified"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("kyb_status", "rejected"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("user_type", "supplier"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("companies")
      .select("id, business_name, contact_person, city, state, submitted_at")
      .eq("kyb_status", "pending")
      .order("submitted_at", { ascending: true, nullsFirst: true })
      .limit(5),
    supabase
      .from("companies")
      .select(
        "id, business_name, kyb_status, verified_at, reviewed_by, profiles!companies_reviewed_by_fkey(email)",
      )
      .in("kyb_status", ["verified", "rejected"])
      .order("verified_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 grid min-w-0 gap-0.5">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Supplier applications, product listings, and admin activity.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 @lg/content:grid-cols-4">
        <KpiStat label="To verify" value={pendingCount ?? 0} />
        <KpiStat label="Approved" value={verifiedCount ?? 0} />
        <KpiStat label="Needs changes" value={rejectedCount ?? 0} />
        <KpiStat label="Total suppliers" value={supplierCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 @lg/content:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="grid min-w-0 gap-0.5">
                  <CardTitle className="text-base font-medium">
                    Needs attention
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Oldest applications waiting for review.
                  </CardDescription>
                </div>
                {(pendingCount ?? 0) > 0 ? (
                  <Button
                    render={
                      <Link href="/admin/dashboard/supplier-verification" />
                    }
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
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {!waiting || waiting.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  All clear — nothing waiting.
                </p>
              ) : (
                <ItemGroup>
                  {waiting.map((c) => (
                    <Item key={c.id} variant="outline" size="sm">
                      <ItemContent>
                        <ItemTitle>{c.business_name}</ItemTitle>
                        <ItemDescription>
                          {c.contact_person} — {c.city}, {c.state}
                          {c.submitted_at
                            ? ` — ${new Date(c.submitted_at).toLocaleDateString()}`
                            : null}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          render={
                            <Link
                              href={`/admin/dashboard/supplier-verification/${c.id}`}
                            />
                          }
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          Review
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </CardContent>
          </Card>

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Recent activity
            </CardTitle>
            <CardDescription className="text-xs">
              Latest decisions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!recentDecisions || recentDecisions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No decisions yet.
              </p>
            ) : (
              <ItemGroup>
                {recentDecisions.map((c) => (
                  <Item key={c.id} size="sm">
                    <ItemContent>
                      <ItemTitle>{c.business_name}</ItemTitle>
                      <ItemDescription>
                        by{" "}
                        {(Array.isArray(c.profiles)
                          ? c.profiles[0]?.email
                          : (c.profiles as { email: string } | null)
                              ?.email) ?? "unknown"}
                        {c.verified_at
                          ? ` — ${new Date(c.verified_at).toLocaleDateString()}`
                          : null}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <StatusBadge status="kyb" value={c.kyb_status} />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}