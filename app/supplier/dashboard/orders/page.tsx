import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  Alert01Icon,
  PackageProcessIcon,
  ShoppingCart01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "cn";
import { PageHeader } from "@/components/layout/page-header";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { SupplierOrdersTable, type SupplierOrderListItem } from "./supplier-orders-table";

export const metadata: Metadata = { title: "Orders" };

const BASE = "/supplier/dashboard/orders";
const PAGE_SIZE = 50;

const ORDER_STATUS_KEYS = [
  "new",
  "quoted",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
type OrderStatusKey = (typeof ORDER_STATUS_KEYS)[number];

type OrderRow = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  subtotal: number;
  item_count: number;
  created_at: string;
  updated_at: string;
  delivery: { fullName?: string } | null;
};

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 text-[11px] tabular-nums",
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const paymentClaimOnly = params.payment === "claimed";
  const requested = (params.status ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is OrderStatusKey =>
      (ORDER_STATUS_KEYS as readonly string[]).includes(value),
    );

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) {
    redirect("/supplier/onboarding");
  }
  const companyId = ctx.companyId;

  const headCount = () =>
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", companyId);

  const [
    { count: totalCount },
    { count: awaitingCount },
    { count: quotedCount },
    { count: claimCount },
    { count: processingCount },
    { count: shippedCount },
    { count: deliveredCount },
    { count: cancelledCount },
  ] = await Promise.all([
    headCount(),
    headCount().eq("status", "new"),
    headCount().eq("status", "quoted"),
    headCount().eq("payment_status", "claimed"),
    headCount().eq("status", "processing"),
    headCount().eq("status", "shipped"),
    headCount().eq("status", "delivered"),
    headCount().eq("status", "cancelled"),
  ]);

  let query = supabase
    .from("orders")
    .select(
      "id, reference, status, payment_status, subtotal, item_count, created_at, updated_at, delivery",
    )
    .eq("supplier_id", companyId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (requested.length === 1) {
    query = query.eq("status", requested[0]);
  } else if (requested.length > 1) {
    query = query.in("status", requested);
  }
  if (paymentClaimOnly) {
    query = query.eq("payment_status", "claimed");
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const orders: SupplierOrderListItem[] = ((data ?? []) as OrderRow[]).map(
    (order) => ({
      id: order.id,
      reference: order.reference,
      status: order.status,
      paymentStatus: order.payment_status,
      subtotal: Number(order.subtotal),
      itemCount: order.item_count,
      buyerName: order.delivery?.fullName ?? null,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }),
  );

  const activeKey = paymentClaimOnly
    ? "payment-claimed"
    : requested.length === 1
      ? requested[0]
      : "all";

  const filters = [
    { key: "all", label: "All orders", href: BASE, count: totalCount ?? 0 },
    { key: "new", label: "Awaiting review", href: `${BASE}?status=new`, count: awaitingCount ?? 0 },
    { key: "quoted", label: "Quoted", href: `${BASE}?status=quoted`, count: quotedCount ?? 0 },
    {
      key: "payment-claimed",
      label: "Payment to confirm",
      href: `${BASE}?payment=claimed`,
      count: claimCount ?? 0,
    },
    {
      key: "processing",
      label: "Processing",
      href: `${BASE}?status=processing`,
      count: processingCount ?? 0,
    },
    { key: "shipped", label: "Shipped", href: `${BASE}?status=shipped`, count: shippedCount ?? 0 },
    {
      key: "delivered",
      label: "Delivered",
      href: `${BASE}?status=delivered`,
      count: deliveredCount ?? 0,
    },
    {
      key: "cancelled",
      label: "Cancelled",
      href: `${BASE}?status=cancelled`,
      count: cancelledCount ?? 0,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader
        title="Orders"
        description="Manage and fulfil your orders."
        actions={
          <Link
            href="/supplier/dashboard"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to dashboard
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label="Total orders"
          value={totalCount ?? 0}
          icon={ShoppingCart01Icon}
          accent="info"
        />
        <KpiStat
          label="Awaiting review"
          value={awaitingCount ?? 0}
          icon={Alert01Icon}
          accent="warning"
          href={`${BASE}?status=new`}
        />
        <KpiStat
          label="Payments to confirm"
          value={claimCount ?? 0}
          icon={Wallet01Icon}
          accent="primary"
          href={`${BASE}?payment=claimed`}
          caption={claimCount ? "Verify buyer claims" : undefined}
        />
        <KpiStat
          label="Processing"
          value={processingCount ?? 0}
          icon={PackageProcessIcon}
          accent="violet"
          href={`${BASE}?status=processing`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <FilterChip
            key={filter.key}
            href={filter.href}
            label={filter.label}
            count={filter.count}
            active={activeKey === filter.key}
          />
        ))}
      </div>

      <SupplierOrdersTable orders={orders} basePath={BASE} />
    </div>
  );
}
