import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { key: "pending", label: "Waiting for review" },
  { key: "verified", label: "Approved" },
  { key: "rejected", label: "Needs changes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type AdminQueuePageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminQueuePage({ searchParams }: AdminQueuePageProps) {
  const { tab } = await searchParams;
  const active: TabKey =
    tab === "verified" || tab === "rejected" ? tab : "pending";

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

  const counts: Record<TabKey, number> = {
    pending: pendingCount ?? 0,
    verified: verifiedCount ?? 0,
    rejected: rejectedCount ?? 0,
  };

  const { data: companies } = await supabase
    .from("companies")
    .select("id, business_name, contact_person, city, state, submitted_at")
    .eq("kyb_status", active)
    .order("submitted_at", { ascending: true, nullsFirst: true });

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Supplier applications</CardTitle>
          <CardDescription>
            Review each business, open its documents, then approve or send back with a note.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <Button
                key={t.key}
                render={<Link href={`/admin?tab=${t.key}`} />}
                nativeButton={false}
                variant={active === t.key ? "default" : "outline"}
                className="flex-1"
              >
                {t.label} ({counts[t.key]})
              </Button>
            ))}
          </div>
          <Separator />
          {!companies || companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing here right now.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {companies.map((c) => (
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
                    render={<Link href={`/admin/${c.id}`} />}
                    nativeButton={false}
                    variant="outline"
                  >
                    Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
