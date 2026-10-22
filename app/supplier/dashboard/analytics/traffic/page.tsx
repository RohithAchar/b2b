import Link from "next/link";
import { redirect } from "next/navigation";
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
import {
  DASHBOARD_RANGE_LABELS,
  parseDashboardRange,
} from "@/lib/supplier/analytics";
import { getTrafficAnalytics } from "@/lib/supplier/traffic-analytics";
import { DashboardRangeFilter } from "@/components/dashboard/dashboard-range-filter";
import { MetricCard } from "@/components/dashboard/metric-card";
import { TrafficChart } from "@/components/dashboard/lazy-charts";
import { ShareBars } from "@/components/dashboard/share-bars";

const TRAFFIC_BASE = "/supplier/dashboard/analytics/traffic";

const NOT_ENOUGH_DATA = "Not enough data to show";

export default async function TrafficAnalyticsPage({
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
    analytics = await getTrafficAnalytics(supabase, ctx.companyId, range);
  } catch (error) {
    analyticsError = error instanceof Error ? error.message : "Could not load traffic analytics.";
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Traffic analytics</h1>
          <p className="text-sm text-muted-foreground">
            {DASHBOARD_RANGE_LABELS[range]} · storefront visits only, never order counts
          </p>
        </div>
        <DashboardRangeFilter range={range} base={TRAFFIC_BASE} />
      </div>

      {analyticsError || !analytics ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load traffic analytics{analyticsError ? `: ${analyticsError}` : "."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MetricCard
              label="Average store views per day"
              info="Storefront product views divided by days in the selected period."
              value={
                analytics.totalViews.value === 0 ? (
                  <span className="text-base font-medium text-muted-foreground">
                    {NOT_ENOUGH_DATA}.
                  </span>
                ) : (
                  analytics.avgViewsPerDay.value
                )
              }
              changePct={analytics.totalViews.value === 0 ? null : analytics.avgViewsPerDay.changePct}
            />
            <MetricCard
              label="Returning visitors"
              info="Visitors in the period seen at your store before the period started."
              value={
                analytics.totalVisitors.value === 0 ? (
                  <span className="text-base font-medium text-muted-foreground">
                    {NOT_ENOUGH_DATA}.
                  </span>
                ) : (
                  `${analytics.returningVisitors.count} (${analytics.returningVisitors.sharePct}%)`
                )
              }
              changePct={
                analytics.totalVisitors.value === 0 ? null : analytics.returningVisitors.changePct
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Store views</CardTitle>
                <CardDescription>
                  {analytics.totalViews.value} views
                  {analytics.totalViews.changePct !== null
                    ? ` · ${analytics.totalViews.changePct >= 0 ? "+" : ""}${analytics.totalViews.changePct}% vs previous`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.totalViews.value === 0 ? (
                  <Empty>
                    <EmptyTitle>{NOT_ENOUGH_DATA}</EmptyTitle>
                    <EmptyDescription>
                      Views in this period will appear here. Share your{" "}
                      <Link href="/supplier/dashboard" className="underline underline-offset-4 hover:text-primary">
                        store link
                      </Link>{" "}
                      to start tracking traffic.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <TrafficChart
                    data={analytics.viewsSeries}
                    dataKey="views"
                    label="Views"
                    color="var(--primary)"
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Visitors</CardTitle>
                <CardDescription>
                  {analytics.totalVisitors.value} visitors
                  {analytics.totalVisitors.changePct !== null
                    ? ` · ${analytics.totalVisitors.changePct >= 0 ? "+" : ""}${analytics.totalVisitors.changePct}% vs previous`
                    : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.totalVisitors.value === 0 ? (
                  <Empty>
                    <EmptyTitle>{NOT_ENOUGH_DATA}</EmptyTitle>
                    <EmptyDescription>
                      Visitor activity in this period will appear here.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <TrafficChart
                    data={analytics.visitorsSeries}
                    dataKey="visitors"
                    label="Visitors"
                    color="var(--chart-2)"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sessions by source</CardTitle>
                <CardDescription>Where store sessions started.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.sourceShares.length === 0 ? (
                  <Empty>
                    <EmptyTitle>{NOT_ENOUGH_DATA}</EmptyTitle>
                    <EmptyDescription>
                      Source breakdown appears once attributed sessions arrive.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ShareBars
                    items={analytics.sourceShares.map((share) => ({
                      label: share.label,
                      sharePct: share.sharePct,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Views by device type</CardTitle>
                <CardDescription>Desktop, mobile and tablet share of views.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.deviceShares.length === 0 ? (
                  <Empty>
                    <EmptyTitle>{NOT_ENOUGH_DATA}</EmptyTitle>
                    <EmptyDescription>
                      Device breakdown appears once attributed views arrive.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <ShareBars
                    items={analytics.deviceShares.map((share) => ({
                      label: share.label,
                      sharePct: share.sharePct,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
