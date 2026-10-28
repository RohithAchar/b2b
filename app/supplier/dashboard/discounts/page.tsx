import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
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
import { SearchInput } from "@/components/dashboard/search-input";
import { CouponCard } from "@/components/dashboard/coupon-card";
import {
  COUPON_TYPES,
  COUPON_TYPE_LABELS,
  parseCouponType,
  type CouponRule,
  type CouponType,
} from "@/lib/supplier/coupons";

const BASE = "/supplier/dashboard/discounts";
const PAGE_SIZE = 100;
const STATS_PAGE_SIZE = 5000;

type CouponRow = CouponRule & { created_at: string };

function hrefFor(type: CouponType | "all", q: string): string {
  const params = new URLSearchParams();
  if (type !== "all") params.set("type", type);
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `${BASE}?${query}` : BASE;
}

export default async function SupplierDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const activeType = parseCouponType(params.type);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) {
    redirect("/supplier/onboarding");
  }
  const supplierId = ctx.companyId;
  const storePath = `/store/${supplierId}`;

  let coupons: CouponRow[] = [];
  let counts: Record<string, number> = {};
  const stats = new Map<string, { timesUsed: number; totalSales: number }>();
  let freeTitles = new Map<string, string>();
  let loadError: string | null = null;

  try {
    const countsQuery = supabase
      .from("coupons")
      .select("type")
      .eq("supplier_id", supplierId)
      .limit(PAGE_SIZE);
    let listQuery = supabase
      .from("coupons")
      .select(
        "id, code, type, is_active, percent_value, max_discount, flat_value, min_order_value, buy_quantity, get_quantity, free_product_id, loyalty_points, usage_limit, used_count, expires_at, created_at",
      )
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (activeType) {
      listQuery = listQuery.eq("type", activeType);
    }
    if (q) {
      listQuery = listQuery.ilike("code", `%${q}%`);
    }

    const [{ data: countRows, error: countsError }, { data: couponRows, error: couponsError }] =
      await Promise.all([countsQuery, listQuery]);
    if (countsError) throw countsError;
    if (couponsError) throw couponsError;

    counts = {};
    for (const row of (countRows ?? []) as { type: string }[]) {
      counts[row.type] = (counts[row.type] ?? 0) + 1;
    }
    coupons = (couponRows ?? []) as unknown as CouponRow[];

    const freeIds = [...new Set(coupons.map((c) => c.free_product_id).filter((id): id is string => !!id))];
    const [{ data: orderRows, error: ordersError }, freeProducts] = await Promise.all([
      supabase
        .from("orders")
        .select("coupon_id, subtotal")
        .eq("supplier_id", supplierId)
        .not("coupon_id", "is", null)
        .limit(STATS_PAGE_SIZE),
      freeIds.length > 0
        ? supabase.from("products").select("id, title").in("id", freeIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    if (ordersError) throw ordersError;
    for (const order of (orderRows ?? []) as { coupon_id: string; subtotal: number }[]) {
      const entry = stats.get(order.coupon_id) ?? { timesUsed: 0, totalSales: 0 };
      entry.timesUsed += 1;
      entry.totalSales += order.subtotal;
      stats.set(order.coupon_id, entry);
    }
    freeTitles = new Map(
      ((freeProducts.data ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]),
    );
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load coupons.";
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={BASE} className="min-w-0 flex-1 sm:max-w-xs">
          {activeType ? <input type="hidden" name="type" value={activeType} /> : null}
          <SearchInput placeholder="Search coupons…" defaultValue={q} />
        </form>
        <Button render={<Link href={`${BASE}/new`} />} nativeButton={false}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Create a coupon
        </Button>
      </div>

      <nav aria-label="Coupon type" className="flex flex-wrap gap-1.5">
        <Button
          render={<Link href={hrefFor("all", q)} />}
          nativeButton={false}
          variant={activeType ? "outline" : "default"}
          size="sm"
        >
          All
        </Button>
        {COUPON_TYPES.map((type) => (
          <Button
            key={type}
            render={<Link href={hrefFor(type, q)} />}
            nativeButton={false}
            variant={activeType === type ? "default" : "outline"}
            size="sm"
          >
            {COUPON_TYPE_LABELS[type]}
            <span className="tabular-nums opacity-70">{counts[type] ?? 0}</span>
          </Button>
        ))}
      </nav>

      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : coupons.length === 0 ? (
        <Empty>
          <EmptyTitle>{q || activeType ? "No coupons match" : "No coupons yet"}</EmptyTitle>
          <EmptyDescription>
            {q || activeType
              ? "Try a different search or filter."
              : "Create your first coupon to start rewarding buyers."}
          </EmptyDescription>
          {!q && !activeType ? (
            <Button render={<Link href={`${BASE}/new`} />} nativeButton={false}>
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Create a coupon
            </Button>
          ) : null}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {coupons.map((coupon) => {
            const couponStats = stats.get(coupon.id) ?? { timesUsed: 0, totalSales: 0 };
            return (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                freeProductTitle={coupon.free_product_id ? (freeTitles.get(coupon.free_product_id) ?? null) : null}
                timesUsed={couponStats.timesUsed}
                totalSales={couponStats.totalSales}
                storePath={storePath}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
