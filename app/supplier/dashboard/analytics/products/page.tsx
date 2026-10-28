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
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { publicTransformedImageUrl } from "@/lib/storage";
import { formatRupees } from "@/lib/format";
import {
  DASHBOARD_RANGE_LABELS,
  parseDashboardRange,
} from "@/lib/supplier/analytics";
import { getProductAnalytics } from "@/lib/supplier/product-analytics";
import { DashboardRangeFilter } from "@/components/dashboard/dashboard-range-filter";
import { InfoTip } from "@/components/dashboard/metric-card";
import { TrafficChart } from "@/components/dashboard/lazy-charts";
import { ShareBars } from "@/components/dashboard/share-bars";

const PRODUCTS_BASE = "/supplier/dashboard/analytics/products";

function thumbUrl(path: string | null): string | null {
  if (!path) return null;
  return publicTransformedImageUrl("product_images", path, { width: 160 });
}

export default async function ProductsAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = parseDashboardRange(rawRange);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
    analytics = await getProductAnalytics(supabase, ctx.companyId, range);
  } catch (error) {
    analyticsError = error instanceof Error ? error.message : "Could not load product analytics.";
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Products analytics</h1>
          <p className="text-sm text-muted-foreground">
            {DASHBOARD_RANGE_LABELS[range]} · units sold and revenue share
          </p>
        </div>
        <DashboardRangeFilter range={range} base={PRODUCTS_BASE} />
      </div>

      {analyticsError || !analytics ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load product analytics{analyticsError ? `: ${analyticsError}` : "."}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  Product performance
                  <InfoTip
                    label="Product performance"
                    info="Total units sold across all products in the selected period."
                  />
                </CardTitle>
                <CardDescription>
                  {analytics.totalUnits} units sold · {DASHBOARD_RANGE_LABELS[range].toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.totalUnits === 0 ? (
                  <Empty>
                    <EmptyTitle>No sales in this range</EmptyTitle>
                    <EmptyDescription>
                      Units sold in this period will appear here.
                    </EmptyDescription>
                  </Empty>
                ) : (
                  <TrafficChart
                    data={analytics.unitsSeries}
                    dataKey="units"
                    label="Units"
                    color="var(--primary)"
                  />
                )}
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  Top categories by sales
                  <InfoTip
                    label="Top categories by sales"
                    info="Share of revenue (not units) contributed by each category in the period."
                  />
                </CardTitle>
                <CardDescription>Top five categories by revenue contribution.</CardDescription>
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
                  <ShareBars
                    items={analytics.topCategories.map((category) => ({
                      label: category.label,
                      sharePct: category.sharePct,
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Top products by units sold
                <InfoTip
                  label="Top products by units sold"
                  info="Best-selling products ranked by quantity sold in the selected period."
                />
              </CardTitle>
              <CardDescription>Ranked by quantity sold, with revenue for context.</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.topProducts.length === 0 ? (
                <Empty>
                  <EmptyTitle>Not enough data to show</EmptyTitle>
                  <EmptyDescription>
                    Your best sellers in this period will appear here.
                  </EmptyDescription>
                </Empty>
              ) : (
                <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {analytics.topProducts.map((product, index) => {
                    const image = thumbUrl(product.imagePath);
                    return (
                      <li
                        key={product.productId}
                        className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt=""
                            className="size-14 shrink-0 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
                            No image
                          </span>
                        )}
                        <div className="grid min-w-0 gap-0.5">
                          <p className="truncate text-sm font-medium">
                            <span className="mr-1.5 text-muted-foreground tabular-nums">
                              {index + 1}.
                            </span>
                            <Link
                              href={`/supplier/dashboard/products/${product.productId}/edit`}
                              className="hover:underline"
                            >
                              {product.title}
                            </Link>
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {product.units} unit{product.units === 1 ? "" : "s"} sold ·{" "}
                            {formatRupees(product.revenue)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
