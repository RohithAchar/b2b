import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { fetchCustomerPricing } from "@/lib/pricing-data";
import { SearchInput } from "@/components/dashboard/search-input";
import { StatusBadge } from "@/components/dashboard/status-badge";

const TABS = [
  { key: "pending", label: "To review" },
  { key: "approved", label: "Live" },
  { key: "rejected", label: "Sent back" },
] as const;

const BASE = "/admin/dashboard/products";

type TabKey = (typeof TABS)[number]["key"];

function supplierName(s: unknown): string {
  if (Array.isArray(s))
    return (s[0] as { business_name?: string } | undefined)?.business_name ?? "—";
  return (s as { business_name?: string } | null)?.business_name ?? "—";
}

function supplierMarginPct(s: unknown): number | null {
  const row = Array.isArray(s) ? s[0] : s;
  const value = (row as { margin_pct?: number | null } | null | undefined)?.margin_pct;
  return value == null ? null : Number(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeTabValue: TabKey =
    params.tab === "approved" || params.tab === "rejected" ? params.tab : "pending";
  const q = (params.q ?? "").trim();
  const supabase = await createClient();

  const counts: Record<TabKey, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const t of TABS) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", t.key);
    counts[t.key] = count ?? 0;
  }

  let query = supabase
    .from("products")
    .select("id, title, unit, moq, status, submitted_at, supplier:supplier_id(business_name, margin_pct)")
    .eq("status", activeTabValue)
    .order("submitted_at", { ascending: true, nullsFirst: true });
  if (q) query = query.ilike("title", `%${q}%`);
  const { data: products } = await query;

  const ids = (products ?? []).map((p) => p.id);
  const pricing = await fetchCustomerPricing(
    supabase,
    (products ?? []).map((p) => ({
      id: p.id as string,
      margin_pct: supplierMarginPct(p.supplier),
    })),
  );
  const covers = new Map<string, string>();
  if (ids.length > 0) {
    const { data: images } = await supabase
      .from("product_images")
      .select("product_id, path")
      .in("product_id", ids)
      .order("sort");
    for (const img of images ?? []) {
      if (!covers.has(img.product_id)) covers.set(img.product_id, img.path);
    }
  }

  function imageUrl(path: string): string {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${path}`;
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">
            Product moderation
          </h1>
          <p className="text-sm text-muted-foreground">
            Review listings, check images and variants, then approve or send back.
          </p>
        </div>
        <form action={BASE} className="w-full sm:w-72">
          <input type="hidden" name="tab" value={activeTabValue} />
          <SearchInput
            name="q"
            placeholder="Search products…"
            defaultValue={q}
          />
        </form>
      </div>

      <div className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`${BASE}?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`inline-flex items-center gap-2 rounded-[4px] border px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTabValue === t.key
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              <span className="tabular-nums opacity-75">{counts[t.key]}</span>
            </Link>
          ))}
        </div>
        <Separator />
        {!products || products.length === 0 ? (
          <Empty>
            <EmptyTitle>Nothing here</EmptyTitle>
            <EmptyDescription>
              {q
                ? `No products match “${q}”.`
                : `No ${activeTabValue} products right now.`}
            </EmptyDescription>
          </Empty>
        ) : (
          <ItemGroup>
            {products.map((p) => (
              <Item key={p.id} variant="outline" size="sm">
                {covers.get(p.id) ? (
                  <ItemMedia variant="image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(covers.get(p.id)!)} alt="" />
                  </ItemMedia>
                ) : null}
                <ItemContent>
                  <ItemTitle>{p.title}</ItemTitle>
                  <ItemDescription>
                    {supplierName(p.supplier)} — ₹{pricing.get(p.id)?.customer_price ?? 0} /{" "}
                    {p.unit} — MOQ {p.moq}
                    {p.submitted_at
                      ? ` — submitted ${formatDate(p.submitted_at)}`
                      : null}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusBadge status="product" value={activeTabValue} />
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
      </div>
    </div>
  );
}