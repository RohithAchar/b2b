import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { formatRupees } from "@/lib/format";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { StatusBadge } from "@/components/dashboard/status-badge";

const ORDER_TABS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = (typeof ORDER_TABS)[number]["key"];
type OrderStatus = Exclude<TabKey, "all">;

const ORDER_STATUS_KEYS: OrderStatus[] = ["new", "confirmed", "shipped", "delivered", "cancelled"];

const BASE = "/supplier/dashboard/orders";
const PAGE_SIZE = 50;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type OrderRow = {
  id: string;
  status: string;
  subtotal: number;
  item_count: number;
  created_at: string;
};

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  // The dashboard deep-links single statuses ("new") and the ship queue
  // ("new,confirmed"); anything else falls back to the full list.
  const requested = (params.status ?? "all")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is OrderStatus => (ORDER_STATUS_KEYS as string[]).includes(s));
  const activeTab: TabKey =
    requested.length === 1 && params.status === requested[0] ? requested[0] : "all";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!company) {
    redirect("/supplier/onboarding");
  }

  let query = supabase
    .from("orders")
    .select("id, status, subtotal, item_count, created_at")
    .eq("supplier_id", company.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (requested.length === 1) {
    query = query.eq("status", requested[0]);
  } else if (requested.length > 1) {
    query = query.in("status", requested);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const orders = (data ?? []) as OrderRow[];
  const filteredValue = orders.reduce((sum, o) => sum + o.subtotal, 0);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Newest first · showing up to {PAGE_SIZE}
          </p>
        </div>
        <Button
          render={<Link href="/supplier/dashboard" />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Dashboard
        </Button>
      </div>

      <nav aria-label="Order status" className="flex flex-wrap gap-1.5">
        {ORDER_TABS.map((tab) => (
          <Button
            key={tab.key}
            render={<Link href={tab.key === "all" ? BASE : `${BASE}?status=${tab.key}`} />}
            nativeButton={false}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label="Orders shown"
          value={orders.length}
          caption={activeTab === "all" ? "All statuses" : ORDER_TABS.find((t) => t.key === activeTab)?.label}
        />
        <KpiStat
          label="Combined value"
          value={formatRupees(filteredValue)}
          caption="Sum of listed orders"
        />
      </div>

      <Card className="!gap-0 !pb-0">
        <CardHeader className="border-b border-border">
          <CardTitle>Order list</CardTitle>
          <CardDescription>
            {requested.length > 0 && activeTab === "all"
              ? `Filtered: ${requested.join(", ")}`
              : "Every order for your store."}
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          {orders.length === 0 ? (
            <Empty className="!border-0">
              <EmptyTitle>No orders here</EmptyTitle>
              <EmptyDescription>
                {activeTab === "all"
                  ? "Orders will appear once buyers start buying."
                  : "No orders with this status. Try another filter."}
              </EmptyDescription>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right tabular-nums">Items</TableHead>
                  <TableHead className="text-right tabular-nums">Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">
                      #{order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{order.item_count}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatRupees(order.subtotal)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="order" value={order.status} />
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
