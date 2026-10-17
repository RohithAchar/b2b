import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
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
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { getBuyerOrders } from "@/lib/buyer/order-history";
import { ORDER_STATUS_LABELS } from "@/lib/orders/lifecycle";
import { formatRupees } from "@/lib/format";

export const metadata: Metadata = {
  title: "My Orders",
  description: "Track every order you have placed on this marketplace.",
};

const BASE = "/orders";

// Buyer-friendly groupings rather than the raw lifecycle vocabulary.
const ORDER_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "With supplier" },
  { key: "active", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = (typeof ORDER_TABS)[number]["key"];

const TAB_STATUSES: Record<Exclude<TabKey, "all">, string[]> = {
  pending: ["new", "quoted"],
  active: ["confirmed", "processing", "shipped"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

function isTabKey(value: string): value is TabKey {
  return ORDER_TABS.some((tab) => tab.key === value);
}

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  new: "secondary",
  quoted: "secondary",
  confirmed: "default",
  processing: "default",
  shipped: "default",
  delivered: "outline",
  cancelled: "outline",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function BuyerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    redirect("/auth/login?next=/orders");
  }

  const { status } = await searchParams;
  const activeTab: TabKey = status && isTabKey(status) ? status : "all";

  const orders = await getBuyerOrders(supabase, user.id);
  const shown =
    activeTab === "all"
      ? orders
      : orders.filter((order) =>
          TAB_STATUSES[activeTab].includes(order.status),
        );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">
          My Orders
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every order you have placed on this marketplace, newest first.
        </p>
      </div>

      <nav aria-label="Order status" className="flex flex-wrap gap-1.5">
        {ORDER_TABS.map((tab) => (
          <Button
            key={tab.key}
            render={
              <Link href={tab.key === "all" ? BASE : `${BASE}?status=${tab.key}`} />
            }
            nativeButton={false}
            variant={activeTab === tab.key ? "default" : "outline"}
            size="sm"
          >
            {tab.label}
          </Button>
        ))}
      </nav>

      <Card className="!gap-0 !pb-0">
        <CardHeader className="border-b border-border">
          <CardTitle>Your orders</CardTitle>
          <CardDescription>
            Select an order to see items, quotations, payment and delivery
            status, and to contact the supplier.
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          {shown.length === 0 ? (
            <Empty className="!border-0">
              <EmptyTitle>No orders here</EmptyTitle>
              <EmptyDescription>
                {activeTab === "all"
                  ? "Orders you place will appear here."
                  : "No orders in this group right now."}
              </EmptyDescription>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead className="hidden sm:table-cell">Supplier</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right tabular-nums">Items</TableHead>
                  <TableHead className="text-right tabular-nums">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link
                        href={`${BASE}/${order.id}`}
                        className="font-mono text-xs font-medium underline-offset-2 hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden max-w-48 truncate text-muted-foreground sm:table-cell">
                      {order.supplierName ?? "—"}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.itemCount}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatRupees(order.total)}
                      {order.hasAcceptedQuote ? (
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          quoted
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[order.status] ?? "outline"}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
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
