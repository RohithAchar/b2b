import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { createClient } from "@/lib/supabase/server";

function StatCard({
  label,
  value,
  action,
}: {
  label: string;
  value: number;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const { count: pendingCount } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("kyb_status", "pending");
  const { count: verifiedCount } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("kyb_status", "verified");
  const { count: rejectedCount } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("kyb_status", "rejected");
  const { count: supplierCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_type", "supplier");

  const { data: waiting } = await supabase
    .from("companies")
    .select("id, business_name, contact_person, city, state, submitted_at")
    .eq("kyb_status", "pending")
    .order("submitted_at", { ascending: true, nullsFirst: true })
    .limit(5);

  const { data: recent } = await supabase
    .from("companies")
    .select(
      "id, business_name, kyb_status, verified_at, reviewed_by, profiles!companies_reviewed_by_fkey(email)",
    )
    .in("kyb_status", ["verified", "rejected"])
    .order("verified_at", { ascending: false })
    .limit(5);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Supplier applications at a glance.
          </p>
        </div>
        <Button
          render={<Link href="/admin/dashboard/supplier-verification" />}
          nativeButton={false}
        >
          Review applications
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="To verify" value={pendingCount ?? 0} />
        <StatCard label="Approved" value={verifiedCount ?? 0} />
        <StatCard label="Needs changes" value={rejectedCount ?? 0} />
        <StatCard label="Total suppliers" value={supplierCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>
              Oldest applications waiting for review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!waiting || waiting.length === 0 ? (
              <Empty>
                <EmptyTitle>All clear</EmptyTitle>
                <EmptyDescription>
                  Nothing waiting right now.
                </EmptyDescription>
              </Empty>
            ) : (
              <ItemGroup>
                {waiting.map((c) => (
                  <Item key={c.id} variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle>{c.business_name}</ItemTitle>
                      <ItemDescription>
                        {c.contact_person} — {c.city}, {c.state}
                        {c.submitted_at
                          ? ` — submitted ${new Date(c.submitted_at).toLocaleDateString()}`
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

        <Card className="col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            {!recent || recent.length === 0 ? (
              <Empty>
                <EmptyTitle>No decisions yet</EmptyTitle>
                <EmptyDescription>
                  Approvals and rejections will show up here.
                </EmptyDescription>
              </Empty>
            ) : (
              <ItemGroup>
                {recent.map((c) => (
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
                      <Badge
                        variant={
                          c.kyb_status === "verified"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {c.kyb_status === "verified"
                          ? "Approved"
                          : "Needs changes"}
                      </Badge>
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
