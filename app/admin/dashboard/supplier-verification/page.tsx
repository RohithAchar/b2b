import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { SearchInput } from "@/components/dashboard/search-input";
import { StatusBadge } from "@/components/dashboard/status-badge";

const TABS = [
  { key: "pending", label: "To verify" },
  { key: "verified", label: "Approved" },
  { key: "rejected", label: "Needs changes" },
] as const;

const BASE = "/admin/dashboard/supplier-verification";

type TabKey = (typeof TABS)[number]["key"];

type AdminQueuePageProps = {
  searchParams: Promise<{ tab?: string; q?: string }>;
};

export default async function AdminQueuePage({ searchParams }: AdminQueuePageProps) {
  const { tab, q } = await searchParams;
  const activeTabValue: TabKey =
    tab === "verified" || tab === "rejected" ? tab : "pending";
  const search = (q ?? "").trim();

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

  let query = supabase
    .from("companies")
    .select("id, business_name, contact_person, city, state, submitted_at")
    .eq("kyb_status", activeTabValue)
    .order("submitted_at", { ascending: true, nullsFirst: true });
  if (search) {
    query = query.or(`business_name.ilike.%${search}%,contact_person.ilike.%${search}%`);
  }
  const { data: companies } = await query;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">
            Supplier verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Review each business, open its documents, then approve or send back
            with a note.
          </p>
        </div>
        <form action={BASE} className="w-full sm:w-72">
          <input type="hidden" name="tab" value={activeTabValue} />
          <SearchInput
            name="q"
            placeholder="Search businesses…"
            defaultValue={search}
          />
        </form>
      </div>

      <div className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {TABS.map((t) => (
            <Button
              key={t.key}
              render={<Link href={search ? `${BASE}?tab=${t.key}&q=${encodeURIComponent(search)}` : `${BASE}?tab=${t.key}`} />}
              nativeButton={false}
              variant={activeTabValue === t.key ? "default" : "outline"}
              size="sm"
            >
              {t.label} ({counts[t.key]})
            </Button>
          ))}
        </div>
        <Separator />
        {!companies || companies.length === 0 ? (
          <Empty>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>
              {search
                ? `No applications match “${search}”.`
                : "No applications in this queue right now."}
            </EmptyDescription>
          </Empty>
        ) : (
          <ItemGroup>
            {companies.map((c) => (
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
                  <StatusBadge status="kyb" value={activeTabValue} />
                  <Button
                    render={<Link href={`${BASE}/${c.id}`} />}
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
      </div>
    </div>
  );
}