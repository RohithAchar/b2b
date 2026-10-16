import Link from "next/link";
import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { formatRupees } from "@/lib/format";
import {
  DASHBOARD_RANGE_LABELS,
  parseDashboardRange,
} from "@/lib/supplier/analytics";
import { getSalesAnalytics } from "@/lib/supplier/sales-analytics";
import { DashboardRangeFilter } from "@/components/dashboard/dashboard-range-filter";
import { MetricCard } from "@/components/dashboard/metric-card";
import { OrdersChart } from "@/components/dashboard/orders-chart";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { ConversionChart } from "@/components/dashboard/conversion-chart";
import { ShareBars } from "@/components/dashboard/share-bars";

const SALES_BASE = "/supplier/dashboard/analytics/sales";

function ReportLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
    >
      View detailed report
      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.5} className="size-3.5" />
    </Link>
  );
}

export default async function SalesAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = parseDashboardRange(rawRange);

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

  let analytics = null;
  let analyticsError: string | null = null;
  try {
    analytics = await getSalesAnalytics(supabase, ctx.companyId, range);
  } catch (error) {
    analyticsError = error instanceof Error ? error.message : "Could not load sales analytics.";
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales analytics</h1>
          <p className="text-sm text-muted-foreground">
            {DASHBOARD_RANGE_LABELS[range]} · compared with the previous period
          </p>
        </div>
        <DashboardRangeFilter range={range} base={SALES_BASE} />
      </div>

      {analyticsError || !analytics ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load sales analytics{analyticsError ? `: ${analyticsError}` : "."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Average orders per day"
              info="Total orders divided by days in the selected period."
              value={analytics.avgOrdersPerDay.value}
              changePct={analytics.avgOrdersPerDay.changePct}
            />
            <MetricCard
              label="Average order value"
              info="Gross sales divided by total orders in the period."
              value={formatRupees(analytics.avgOrderValue.value)}
              changePct={analytics.avgOrderValue.changePct}
            />
            <MetricCard
              label="Average sales per day"
              info="Gross sales divided by days in the selected period."
              value={formatRupees(analytics.avgSalesPerDay.value)}
              changePct={analytics.avgSalesPerDay.changePct}
            />
            <MetricCard
              label="Returning customers"
              info="Share of ordering buyers in the period who have ordered more than once."
              value={`${analytics.returningPct.value}%`}
              changePct={analytics.returningPct.changePct}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total orders</CardTitle>
                <CardDescription>
                  {analytics.totalOrders.value} orders
                  {analytics.totalOrders.changePct !== null
                    ? ` · ${analytics.totalOrders.changePct >= 0 ? "+" : ""}${analytics.totalOrders.changePct}% vs previous`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {analytics.totalOrders.value === 0 ? (
                  <Empty>
                    <EmptyTitle>No orders in this range</EmptyTitle>
                    <EmptyDescription>
                      Orders placed in this period will appear here.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <OrdersChart data={analytics.ordersSeries} />
                )}
                <ReportLink href="/supplier/dashboard/orders" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Gross sales</CardTitle>
                <CardDescription>
                  {formatRupees(analytics.grossSales.value)}
                  {analytics.grossSales.changePct !== null
                    ? ` · ${analytics.grossSales.changePct >= 0 ? "+" : ""}${analytics.grossSales.changePct}% vs previous`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {analytics.grossSales.value === 0 ? (
                  <Empty>
                    <EmptyTitle>No sales in this range</EmptyTitle>
                    <EmptyDescription>
                      Revenue in this period will appear here.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <SalesChart data={analytics.salesSeries} />
                )}
                <ReportLink href="/supplier/dashboard/orders" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="uppercase">Store conversion rate</CardTitle>
                <CardDescription>{analytics.conversionPct}% of sessions ordered</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {analytics.conversionPct}%
                </p>
                {analytics.sessions === 0 ? (
                  <Empty>
                    <EmptyTitle>No store visits yet</EmptyTitle>
                    <EmptyDescription>
                      Share your store link to start tracking conversion.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ConversionChart data={analytics.conversionSeries} />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Sales by top region</CardTitle>
                <CardDescription>Top five buyer regions by revenue.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topRegions.length === 0 ? (
                  <Empty>
                    <EmptyTitle>Not enough data to show</EmptyTitle>
                    <EmptyDescription>
                      Regional breakdown appears once attributed orders arrive.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ShareBars items={analytics.topRegions} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sales by traffic source</CardTitle>
                <CardDescription>Where ordering sessions came from.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topSources.length === 0 ? (
                  <Empty>
                    <EmptyTitle>Not enough data to show</EmptyTitle>
                    <EmptyDescription>
                      Source breakdown appears once attributed orders arrive.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ShareBars items={analytics.topSources} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sales by category</CardTitle>
                <CardDescription>Top five categories by revenue.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.topCategories.length === 0 ? (
                  <Empty>
                    <EmptyTitle>Not enough data to show</EmptyTitle>
                    <EmptyDescription>
                      Category breakdown appears once orders arrive.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ShareBars items={analytics.topCategories} />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
