import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { parseDashboardRange, resolveRangeBounds } from "@/lib/supplier/analytics";
import {
  CUSTOMER_TABS,
  CUSTOMER_TAB_LABELS,
  filterAudienceByTab,
  parseCustomerSort,
  parseCustomerTab,
  parseSortDirection,
  sortAudience,
  type CustomerTab,
} from "@/lib/supplier/customers";
import { getAudienceCustomers } from "@/lib/supplier/customer-queries";
import { DashboardRangeFilter } from "@/components/dashboard/dashboard-range-filter";
import { SearchInput } from "@/components/dashboard/search-input";
import { CustomerAddDialog } from "@/components/dashboard/customer-add-dialog";
import { CustomerImportDialog } from "@/components/dashboard/customer-import-dialog";
import { CustomerTable } from "@/components/dashboard/customer-table";

const BASE = "/supplier/dashboard/audience";
const PAGE_SIZE = 30;

export default async function SupplierAudiencePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; range?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const tab: CustomerTab = parseCustomerTab(params.tab);
  const range = parseDashboardRange(params.range);
  const sort = parseCustomerSort(params.sort);
  const dir = parseSortDirection(params.dir);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) {
    redirect("/supplier/onboarding");
  }

  let customers = null;
  let loadError: string | null = null;
  try {
    const { from, to } = resolveRangeBounds(range, new Date());
    customers = await getAudienceCustomers(supabase, ctx.companyId, { q, from, to });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load customers.";
  }

  const counts: Record<CustomerTab, number> = { all: 0, new: 0, returning: 0, imported: 0 };
  if (customers) {
    counts.all = customers.length;
    for (const row of customers) {
      counts[row.category] += 1;
    }
  }
  const visible = customers
    ? sortAudience(filterAudienceByTab(customers, tab), sort, dir)
    : [];
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (tab !== "all") exportParams.set("tab", tab);
  exportParams.set("range", range);
  exportParams.set("sort", sort);
  exportParams.set("dir", dir);
  const exportHref = `${BASE}/export?${exportParams.toString()}`;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Audience</h1>
          <p className="text-sm text-muted-foreground">
            Buyers, walk-ins and imports for your store.
          </p>
        </div>
        <DashboardRangeFilter range={range} base={BASE} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={BASE} className="min-w-0 flex-1 sm:max-w-xs">
          {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
          <input type="hidden" name="range" value={range} />
          <SearchInput placeholder="Search name, mobile, city…" defaultValue={q} />
        </form>
        <div className="flex shrink-0 items-center gap-2">
          <CustomerImportDialog />
          <Button
            render={<a href={exportHref} download />}
            nativeButton={false}
            variant="outline"
          >
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} data-icon="inline-start" />
            Export
          </Button>
          <CustomerAddDialog />
        </div>
      </div>

      <nav aria-label="Customer category" className="flex flex-wrap gap-1.5">
        {CUSTOMER_TABS.map((key) => {
          const hrefParams = new URLSearchParams();
          if (q) hrefParams.set("q", q);
          if (key !== "all") hrefParams.set("tab", key);
          hrefParams.set("range", range);
          const query = hrefParams.toString();
          return (
            <Button
              key={key}
              render={<Link href={query ? `${BASE}?${query}` : BASE} />}
              nativeButton={false}
              variant={tab === key ? "default" : "outline"}
              size="sm"
            >
              {CUSTOMER_TAB_LABELS[key]}
              <span className="tabular-nums opacity-70">{counts[key]}</span>
            </Button>
          );
        })}
      </nav>

      {loadError || !customers ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError ?? "Could not load customers."}</AlertDescription>
        </Alert>
      ) : visible.length === 0 ? (
        <Empty>
          <EmptyTitle>{q || tab !== "all" ? "No customers match" : "No customers yet"}</EmptyTitle>
          <EmptyDescription>
            {q || tab !== "all"
              ? "Try a different search or category."
              : "Add customers manually or import a CSV to get started."}
          </EmptyDescription>
        </Empty>
      ) : (
        <CustomerTable
          rows={pageRows}
          sort={sort}
          dir={dir}
          page={safePage}
          totalPages={totalPages}
          total={visible.length}
          pageSize={PAGE_SIZE}
          params={{ q, tab, range }}
        />
      )}
    </div>
  );
}
