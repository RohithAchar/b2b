import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
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
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

const TABS = [
  { key: "pending", label: "To review" },
  { key: "approved", label: "Live" },
  { key: "rejected", label: "Sent back" },
] as const;

const BASE = "/admin/dashboard/products";

function supplierName(s: unknown): string {
  if (Array.isArray(s)) return (s[0] as { business_name?: string } | undefined)?.business_name ?? "—";
  return (s as { business_name?: string } | null)?.business_name ?? "—";
}

type TabKey = (typeof TABS)[number]["key"];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active: TabKey = tab === "approved" || tab === "rejected" ? tab : "pending";
  const supabase = await createClient();

  const counts: Record<TabKey, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const t of TABS) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", t.key);
    counts[t.key] = count ?? 0;
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, title, price_per_unit, unit, moq, status, submitted_at, supplier:supplier_id(business_name)")
    .eq("status", active)
    .order("submitted_at", { ascending: true, nullsFirst: true });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Product approvals</CardTitle>
          <CardDescription>
            Review listings, check images and variants, then approve or send
            back.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <Button
                key={t.key}
                render={<Link href={`${BASE}?tab=${t.key}`} />}
                nativeButton={false}
                variant={active === t.key ? "default" : "outline"}
                className="flex-1"
              >
                {t.label} ({counts[t.key]})
              </Button>
            ))}
          </div>
          <Separator />
          {!products || products.length === 0 ? (
            <Empty>
              <EmptyTitle>Nothing here</EmptyTitle>
              <EmptyDescription>No {active} products right now.</EmptyDescription>
            </Empty>
          ) : (
            <ItemGroup>
              {products.map((p) => (
                <Item key={p.id} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>{p.title}</ItemTitle>
                    <ItemDescription>
                      {supplierName(p.supplier)} — ₹{Number(p.price_per_unit)} /{" "}
                      {p.unit} — MOQ {p.moq}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      render={<Link href={`${BASE}/${p.id}`} />}
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
    </div>
  );
}
