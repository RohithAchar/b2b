import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Package01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { fetchCustomerPricing } from "@/lib/pricing-data";
import { ProductTable, type ProductRow } from "@/components/dashboard/product-table";
import {
  ProductToolbar,
} from "@/components/dashboard/product-toolbar";
import {
  SORT_COLUMNS,
  SORT_KEYS,
  type SortKey,
} from "@/components/dashboard/product-sort";
import { cn } from "cn";

const TABS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Live" },
  { key: "pending", label: "Under review" },
  { key: "rejected", label: "Needs changes" },
  { key: "draft", label: "Drafts" },
] as const;

const BASE = "/supplier/dashboard/products";
const PER_PAGE = 25;

type TabKey = (typeof TABS)[number]["key"];
type StatusKey = Exclude<TabKey, "all">;

const STATUS_KEYS: StatusKey[] = ["approved", "pending", "rejected", "draft"];

function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${path}`;
}

function categoryName(value: unknown): string | null {
  if (Array.isArray(value)) {
    return (value[0] as { name?: string | null } | undefined)?.name ?? null;
  }
  return (value as { name?: string | null } | null)?.name ?? null;
}

function paginationItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const window = new Set([1, total, current - 1, current, current + 1]);
  const items: (number | "…")[] = [];
  let prev = 0;
  for (const n of Array.from(window)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b)) {
    if (prev && n - prev > 1) items.push("…");
    items.push(n);
    prev = n;
  }
  return items;
}

export default async function SupplierProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const active: TabKey = TABS.some((t) => t.key === params.tab)
    ? (params.tab as TabKey)
    : "all";
  const activeSort: SortKey = SORT_KEYS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : "newest";
  const q = (params.q ?? "").trim();
  const requestedPage = Number(params.page) > 0 ? Math.floor(Number(params.page)) : 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, kyb_status, margin_pct")
    .eq("owner_id", user.id)
    .maybeSingle();
  // See app/supplier/dashboard/business/page.tsx: a failed read must not be
  // mistaken for a missing company.
  if (companyError) {
    console.error(
      "Supplier products company query failed:",
      companyError.code,
      companyError.message,
    );
    throw companyError;
  }
  if (!company) redirect("/supplier/onboarding");

  const verified = company.kyb_status === "verified";

  const counts: Record<TabKey, number> = {
    all: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    draft: 0,
  };
  for (const status of STATUS_KEYS) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id)
      .eq("status", status);
    counts[status] = count ?? 0;
    counts.all += count ?? 0;
  }

  let countQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", company.id);
  if (active !== "all") countQuery = countQuery.eq("status", active as StatusKey);
  if (q) countQuery = countQuery.ilike("title", `%${q}%`);
  const { count: total } = await countQuery;

  const pageCount = Math.max(1, Math.ceil((total ?? 0) / PER_PAGE));
  const page = Math.min(Math.max(requestedPage, 1), pageCount);

  const hrefFor = (
    tab: TabKey,
    sortKey: SortKey,
    pageNum: number,
    search: string,
  ) => {
    const sp = new URLSearchParams();
    if (tab !== "all") sp.set("tab", tab);
    if (sortKey !== "newest") sp.set("sort", sortKey);
    if (pageNum > 1) sp.set("page", String(pageNum));
    if (search) sp.set("q", search);
    const qs = sp.toString();
    return qs ? `${BASE}?${qs}` : BASE;
  };

  if (requestedPage !== page) redirect(hrefFor(active, activeSort, page, q));

  const sort = SORT_COLUMNS[activeSort];
  let dataQuery = supabase
    .from("products")
    .select(
      "id, title, unit, moq, stock_qty, status, is_hidden, rejection_note, category:category_id(name)",
    )
    .eq("supplier_id", company.id);
  if (active !== "all") dataQuery = dataQuery.eq("status", active as StatusKey);
  if (q) dataQuery = dataQuery.ilike("title", `%${q}%`);
  const { data: products } = await dataQuery
    .order(sort.column, { ascending: sort.ascending })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  const ids = (products ?? []).map((p) => p.id);
  const pricing = await fetchCustomerPricing(
    supabase,
    ids.map((id) => ({ id, margin_pct: company.margin_pct })),
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

  const rows: ProductRow[] = (products ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    cover: covers.get(p.id) ? imageUrl(covers.get(p.id)!) : null,
    category: categoryName(p.category),
    rejectionNote: p.rejection_note,
    price: pricing.get(p.id)?.customer_price ?? 0,
    unit: p.unit ?? "",
    moq: p.moq,
    stock: Number(p.stock_qty ?? 0),
    status: p.status,
    is_hidden: p.is_hidden ?? false,
  }));

  const searchActive = Boolean(q) || active !== "all";
  const tableKey = hrefFor(active, activeSort, page, q);
  const rangeFrom = rows.length > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const rangeTo = (page - 1) * PER_PAGE + rows.length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">All products</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {verified
              ? "Manage listings, track approvals and fix returns."
              : "Product tools unlock once your business is verified."}
          </p>
        </div>
        {verified ? (
          <Button render={<Link href={`${BASE}/new`} />} nativeButton={false}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            Add new product
          </Button>
        ) : null}
      </div>

      <Card className="!gap-0 !py-0">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {TABS.map((t) => {
                const activeTab = active === t.key;
                return (
                  <Button
                    key={t.key}
                    render={
                      <Link href={hrefFor(t.key, activeSort, page, q)} />
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
            <ProductToolbar
              baseHref={BASE}
              tab={active}
              q={q}
              sort={activeSort}
            />
          </div>
        </CardHeader>
        <CardContent className="!px-0">
          {rows.length === 0 ? (
            <Empty className={cn("!border-0", searchActive ? "!py-10" : "")}>
              {searchActive ? (
                <>
                  <EmptyTitle>Nothing found</EmptyTitle>
                  <EmptyDescription>
                    No products match your current filters.
                  </EmptyDescription>
                  <Button
                    render={<Link href={BASE} />}
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                  >
                    Clear filters
                  </Button>
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
                  {verified ? (
                    <Button
                      render={<Link href={`${BASE}/new`} />}
                      nativeButton={false}
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                      Add new product
                    </Button>
                  ) : null}
                </>
              )}
            </Empty>
          ) : (
            <>
              <ProductTable
                key={tableKey}
                products={rows}
                baseHref={BASE}
                verified={verified}
              />
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm tabular-nums text-muted-foreground">
                  Showing {rangeFrom}–{rangeTo} of {total ?? 0}
                </p>
                {pageCount > 1 ? (
                  <Pagination className="sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        {page > 1 ? (
                          <PaginationPrevious
                            href={hrefFor(active, activeSort, page - 1, q)}
                          />
                        ) : (
                          <PaginationPrevious
                            href={hrefFor(active, activeSort, 1, q)}
                            aria-disabled="true"
                            className="pointer-events-none opacity-50"
                          />
                        )}
                      </PaginationItem>
                      {paginationItems(page, pageCount).map((item, index) =>
                        item === "…" ? (
                          <PaginationItem key={`ellipsis-${index}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : (
                          <PaginationItem key={item}>
                            <PaginationLink
                              href={hrefFor(active, activeSort, item, q)}
                              isActive={item === page}
                            >
                              {item}
                            </PaginationLink>
                          </PaginationItem>
                        ),
                      )}
                      <PaginationItem>
                        {page < pageCount ? (
                          <PaginationNext
                            href={hrefFor(active, activeSort, page + 1, q)}
                          />
                        ) : (
                          <PaginationNext
                            href={hrefFor(active, activeSort, pageCount, q)}
                            aria-disabled="true"
                            className="pointer-events-none opacity-50"
                          />
                        )}
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}