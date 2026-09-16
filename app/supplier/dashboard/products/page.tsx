import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Package01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SearchInput } from "@/components/dashboard/search-input";
import { cn } from "cn";
import { ProductRowButtons } from "./row-buttons";

const TABS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Live" },
  { key: "pending", label: "Under review" },
  { key: "rejected", label: "Needs changes" },
  { key: "draft", label: "Drafts" },
] as const;

const BASE = "/supplier/dashboard/products";

type TabKey = (typeof TABS)[number]["key"];

function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${path}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default async function SupplierProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  const active: TabKey =
    params.tab === "approved" ||
    params.tab === "pending" ||
    params.tab === "rejected" ||
    params.tab === "draft"
      ? params.tab
      : "all";
  const q = (params.q ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const { data: company } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!company) redirect("/supplier/onboarding");

  const verified = company.kyb_status === "verified";

  const { data: statusRows } = await supabase
    .from("products")
    .select("status")
    .eq("supplier_id", company.id);

  const counts: Record<TabKey, number> = {
    all: statusRows?.length ?? 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    draft: 0,
  };
  for (const row of statusRows ?? []) {
    if (row.status in counts) counts[row.status as TabKey] += 1;
  }

  let query = supabase
    .from("products")
    .select(
      "id, title, price_per_unit, unit, moq, stock_qty, status, rejection_note, created_at",
    )
    .eq("supplier_id", company.id);

  if (active !== "all") query = query.eq("status", active);
  if (q) query = query.ilike("title", `%${q}%`);
  query = query.order("created_at", { ascending: false });

  const { data: products } = await query;

  const ids = (products ?? []).map((p) => p.id);
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

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Products</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {verified
              ? "Manage listings, track approvals and fix returns."
              : "Product tools unlock once your business is verified."}
          </p>
        </div>
        {verified ? (
          <Button render={<Link href={`${BASE}/new`} />} nativeButton={false}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            Add product
          </Button>
        ) : null}
      </div>

      <Card className="!gap-0 !py-0">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {TABS.map((t) => {
                const activeTab = active === t.key;
                return (
                  <Button
                    key={t.key}
                    render={
                      <Link
                        href={`${BASE}?tab=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                      />
                    }
                    nativeButton={false}
                    variant={activeTab ? "default" : "outline"}
                    size="sm"
                  >
                    {t.label}
                    <span className="tabular-nums opacity-75">
                      {counts[t.key]}
                    </span>
                  </Button>
                );
              })}
            </div>
            <form action={BASE} className="w-full xl:w-auto">
              <SearchInput
                name="q"
                placeholder="Search products…"
                defaultValue={q}
                className="w-full xl:w-72"
              />
            </form>
          </div>
        </CardHeader>
        <CardContent className="!px-0">
          {!products || products.length === 0 ? (
            <Empty className={cn("!border-0", q || active !== "all" ? "!py-10" : "")}>
              {q || active !== "all" ? (
                <>
                  <EmptyTitle>Nothing found</EmptyTitle>
                  <EmptyDescription>
                    No {active === "all" ? "" : `${active} `}products match your search.
                  </EmptyDescription>
                </>
              ) : (
                <>
                  <EmptyTitle>
                    <span className="flex items-center justify-center gap-2">
                      <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />
                      No products yet
                    </span>
                  </EmptyTitle>
                  <EmptyDescription>
                    {verified
                      ? "Create your first draft to get started."
                      : "Products unlock once your business is verified."}
                  </EmptyDescription>
                </>
              )}
              {verified ? (
                <Button render={<Link href={`${BASE}/new`} />} nativeButton={false}>
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                  Add product
                </Button>
              ) : null}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="hidden md:table-cell">MOQ</TableHead>
                  <TableHead className="hidden lg:table-cell">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="relative hidden size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:block">
                          {covers.get(p.id) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl(covers.get(p.id)!)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`${BASE}/${p.id}/edit`}
                            className="block max-w-56 truncate font-medium hover:underline lg:max-w-72"
                          >
                            {p.title}
                          </Link>
                          {p.status === "rejected" && p.rejection_note ? (
                            <span className="block max-w-56 truncate text-xs text-destructive lg:max-w-72">
                              {p.rejection_note}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      ₹{Number(p.price_per_unit)} / {p.unit}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {p.moq}
                    </TableCell>
                    <TableCell className="hidden tabular-nums lg:table-cell">
                      {p.stock_qty}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="product" value={p.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatDate(p.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          render={<Link href={`${BASE}/${p.id}/edit`} />}
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          Edit
                        </Button>
                        <ProductRowButtons
                          productId={p.id}
                          status={p.status}
                          verified={verified}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}