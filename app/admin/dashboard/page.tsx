import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-2xl font-medium">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-medium">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Supplier applications at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="To verify" value={pendingCount ?? 0} />
        <StatCard label="Approved" value={verifiedCount ?? 0} />
        <StatCard label="Needs changes" value={rejectedCount ?? 0} />
        <StatCard label="Total suppliers" value={supplierCount ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            Oldest applications waiting for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!waiting || waiting.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing waiting right now.
            </p>
          ) : (
            waiting.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {c.business_name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.contact_person} — {c.city}, {c.state}
                  </span>
                </div>
                <Button
                  render={
                    <Link
                      href={`/admin/dashboard/supplier-verification/${c.id}`}
                    />
                  }
                  nativeButton={false}
                  variant="outline"
                >
                  Review
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest decisions.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!recent || recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions yet.</p>
          ) : (
            recent.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-medium">
                    {c.business_name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    by{" "}
                    {(Array.isArray(c.profiles)
                      ? c.profiles[0]?.email
                      : (c.profiles as { email: string } | null)?.email) ??
                      "unknown"}
                  </span>
                </div>
                <Badge
                  variant={
                    c.kyb_status === "verified" ? "default" : "destructive"
                  }
                >
                  {c.kyb_status === "verified" ? "Approved" : "Needs changes"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Separator />
    </div>
  );
}
