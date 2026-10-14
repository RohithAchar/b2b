import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatRupees, formatDateMed } from "@/lib/format";
import { KpiStat } from "@/components/dashboard/kpi-stat";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getCustomerDetail } from "@/lib/supplier/customer-queries";

const BASE = "/supplier/dashboard/audience";

const EVENT_LABELS: Record<string, string> = {
  view: "Viewed a product",
  cart: "Added to cart",
  order: "Placed an order",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  let detail = null;
  let loadError: string | null = null;
  try {
    detail = await getCustomerDetail(supabase, company.id as string, id);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the customer.";
  }
  if (!loadError && !detail) {
    notFound();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="truncate text-xl font-bold tracking-tight">
            {detail?.customer.name ?? "Customer"}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {detail ? (
              <>
                <span>
                  {detail.category === "new" ? "New" : detail.category === "returning" ? "Returning" : "Imported"}
                </span>
                <span>·</span>
                <span>Customer since {formatDateMed(detail.customer.created_at)}</span>
              </>
            ) : (
              "Customer profile"
            )}
          </p>
        </div>
        <Button
          render={<Link href={BASE} />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Audience
        </Button>
      </div>

      {loadError || !detail ? (
        <Alert variant="destructive">
          <AlertDescription>{loadError ?? "Could not load the customer."}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiStat
              label="Total orders"
              value={detail.orderCount}
              caption="Linked orders"
            />
            <KpiStat
              label="Total spending"
              value={formatRupees(detail.totalSales)}
              caption={
                detail.orderCount > 0
                  ? `${formatRupees(Math.round(detail.totalSales / detail.orderCount))} average order`
                  : "No orders yet"
              }
            />
            <Card size="sm" className="!gap-0 !py-0">
              <CardContent className="flex flex-col gap-0.5 py-4">
                <span className="text-xs font-medium text-muted-foreground">Contact</span>
                <span className="truncate text-sm font-semibold tabular-nums">{detail.customer.phone}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[detail.customer.email, detail.customer.city].filter(Boolean).join(" · ") || "—"}
                </span>
              </CardContent>
            </Card>
            <Card size="sm" className="!gap-0 !py-0">
              <CardContent className="flex flex-col gap-0.5 py-4">
                <span className="text-xs font-medium text-muted-foreground">Source</span>
                <span className="text-sm font-semibold capitalize">{detail.customer.source}</span>
                <span className="text-xs text-muted-foreground">
                  {detail.customer.buyer_id ? "Linked account" : "No linked account"}
                </span>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
            <Card className="!gap-0 !pb-0 lg:col-span-4">
              <CardHeader className="border-b border-border">
                <CardTitle>Order history</CardTitle>
                <CardDescription>Every linked order, newest first.</CardDescription>
              </CardHeader>
              <CardContent className="!px-0">
                {detail.orders.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                    No orders yet — manual and imported records gain history once the buyer orders.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="text-right tabular-nums">Value</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-xs">#{order.id.slice(0, 8)}</TableCell>
                          <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                            {formatDateMed(order.created_at)}
                          </TableCell>
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
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Storefront views and carts.</CardDescription>
              </CardHeader>
              <CardContent>
                {detail.activity.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No recorded activity yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {detail.activity.map((item, index) => (
                      <li key={`${item.created_at}-${index}`} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {EVENT_LABELS[item.event] ?? item.event}
                          {item.productTitle ? (
                            <span className="text-muted-foreground"> · {item.productTitle}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                          {formatDateMed(item.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
