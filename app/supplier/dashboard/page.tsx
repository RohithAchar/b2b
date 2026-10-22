import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowRight01Icon,
  Building02Icon,
  ChartAverageIcon,
  DeliveryTruck01Icon,
  Package01Icon,
  ShieldCheckIcon,
  ShoppingCart01Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from "@/lib/supabase/server"
import { LOGIN_PATH } from "@/lib/auth/paths"
import { getSupplierContext } from "@/lib/auth/guard"
import { fetchCustomerPricing } from "@/lib/pricing-data"
import { formatRupees } from "@/lib/format"
import {
  DASHBOARD_RANGE_LABELS,
  getDashboardMetrics,
  parseDashboardRange,
} from "@/lib/supplier/analytics"
import { KpiStat } from "@/components/dashboard/kpi-stat"
import {
  AttentionPanel,
  type AttentionItem,
} from "@/components/dashboard/attention-panel"
import {
  ProfileCompletionCard,
  profileChecklist,
} from "@/components/dashboard/profile-completion"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { DashboardRangeFilter } from "@/components/dashboard/dashboard-range-filter"
import { SalesChart } from "@/components/dashboard/lazy-charts"
import { ConversionChart } from "@/components/dashboard/lazy-charts"
import { StoreLinkCard } from "@/components/dashboard/store-link-card"

function logoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${path}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const CARD_LINK_CLASS =
  "press block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>div]:h-full [&>div]:transition-shadow [&>div]:hover:shadow-md"

export default async function SupplierOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range: rawRange } = await searchParams
  const range = parseDashboardRange(rawRange)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(LOGIN_PATH)
  }

  const ctx = await getSupplierContext(supabase, user.id)
  if (!ctx) {
    redirect("/supplier/onboarding")
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, gst_certificate_path, pan_card_path, license_path, kyb_status, rejection_note, logo_path, submitted_at, margin_pct"
    )
    .eq("id", ctx.companyId)
    .maybeSingle()

  // See app/supplier/dashboard/business/page.tsx: a failed read must not be
  // mistaken for a missing company.
  if (companyError) {
    console.error(
      "Supplier overview company query failed:",
      companyError.code,
      companyError.message
    )
    throw companyError
  }

  if (!company) {
    redirect("/supplier/onboarding")
  }

  const verified = company.kyb_status === "verified"

  // Analytics resolve alongside the product stats so the range filter costs
  // no extra latency. A failure here degrades to an inline error — the
  // product sections below still render.
  const metricsSettled = getDashboardMetrics(
    supabase,
    company.id as string,
    range
  ).then(
    (metrics) => ({ metrics, error: null as string | null }),
    (error: unknown) => ({
      metrics: null,
      error:
        error instanceof Error ? error.message : "Could not load analytics.",
    })
  )

  const thirtyDaysAgo = new Date(
    // eslint-disable-next-line react-hooks/purity -- server component: per-request timestamp
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString()

  const [
    { count: totalCount },
    { count: liveCount },
    { count: pendingCount },
    { count: rejectedCount },
    { count: monthCount },
    { count: paymentClaimCount },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id)
      .eq("status", "approved"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id)
      .eq("status", "pending"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id)
      .eq("status", "rejected"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("supplier_id", company.id)
      .eq("payment_status", "claimed"),
  ])

  const { metrics, error: metricsError } = await metricsSettled

  const { data: recent } = await supabase
    .from("products")
    .select("id, title, unit, moq, stock_qty, status, created_at")
    .eq("supplier_id", company.id)
    .order("created_at", { ascending: false })
    .limit(6)

  const recentPricing = await fetchCustomerPricing(
    supabase,
    (recent ?? []).map((p) => ({
      id: p.id as string,
      margin_pct: company.margin_pct,
    }))
  )

  const checklist = profileChecklist(company)
  const missingCount = checklist.items.filter((i) => !i.done).length

  const attention: AttentionItem[] = []
  if (company.kyb_status === "draft") {
    attention.push({
      id: "kyb-draft",
      title: "Finish your application",
      description:
        "Complete business details, IDs and documents to unlock selling.",
      severity: "error",
      href: "/supplier/onboarding",
      actionLabel: "Continue",
    })
  } else if (company.kyb_status === "rejected") {
    attention.push({
      id: "kyb-rejected",
      title: "Business application needs changes",
      description:
        company.rejection_note ??
        "Review the note and resubmit your application.",
      severity: "error",
      href: "/supplier/onboarding",
      actionLabel: "Fix and resubmit",
    })
  } else if (company.kyb_status === "pending") {
    attention.push({
      id: "kyb-pending",
      title: "Verification under review",
      description: "Listing unlocks once our team verifies your business.",
      severity: "warning",
      href: "/supplier/dashboard/verification",
      actionLabel: "Track",
    })
  }

  if ((paymentClaimCount ?? 0) > 0) {
    attention.push({
      id: "payment-claims",
      title: `${paymentClaimCount} payment claim${paymentClaimCount === 1 ? "" : "s"} to verify`,
      description:
        "Buyers say they have paid. Check the reference in your bank/UPI, then confirm or mark it not received.",
      severity: "warning",
      href: "/supplier/dashboard/orders?payment=claimed",
      actionLabel: "Verify",
    })
  }

  if (verified && (rejectedCount ?? 0) > 0) {
    attention.push({
      id: "products-rejected",
      title: `${rejectedCount} product${rejectedCount === 1 ? "" : "s"} need changes`,
      description: "Fix the notes and resubmit for approval.",
      severity: "error",
      href: "/supplier/dashboard/products?tab=rejected",
      actionLabel: "Review",
    })
  }
  if (missingCount > 0) {
    attention.push({
      id: "profile",
      title: "Complete your business profile",
      description: `${missingCount} detail${missingCount === 1 ? "" : "s"} missing — buyers see this on your storefront.`,
      severity: "info",
      href: "/supplier/dashboard/business",
      actionLabel: "Complete",
    })
  }

  const kybTitle: Record<string, string> = {
    draft: "Start your application",
    pending: "Under review",
    verified: "You are verified",
    rejected: "Needs changes",
  }

  const hasSales = (metrics?.salesSeries ?? []).some((p) => p.sales > 0)
  const hasSessions = (metrics?.sessions ?? 0) > 0

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {company.logo_path ? (
            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src={logoUrl(company.logo_path)}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
          ) : (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-5">
              <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />
            </span>
          )}
          <div className="grid min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-xl font-bold tracking-tight">
              {company.business_name}
            </h1>
            <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
              <span className="truncate">
                {kybTitle[company.kyb_status] ?? company.kyb_status}
              </span>
              <StatusBadge status="kyb" value={company.kyb_status} />
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            render={<Link href="/products" />}
            nativeButton={false}
            variant="outline"
          >
            View marketplace
          </Button>
          {verified ? (
            <Button
              render={<Link href="/supplier/dashboard/products/new" />}
              nativeButton={false}
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
              Add product
            </Button>
          ) : null}
        </div>
      </div>

      {company.kyb_status === "rejected" && company.rejection_note ? (
        <Alert variant="destructive">
          <AlertDescription>{company.rejection_note}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Sales analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            {DASHBOARD_RANGE_LABELS[range]} · live from your orders and store
            visits
          </p>
        </div>
        <DashboardRangeFilter range={range} />
      </div>

      {metricsError || !metrics ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load sales analytics
            {metricsError ? `: ${metricsError}` : "."} Product stats below are
            unaffected.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Link href="/supplier/dashboard/orders" className={CARD_LINK_CLASS}>
              <KpiStat
                label="Total sales"
                value={formatRupees(metrics.salesTotal)}
                caption={`${metrics.orderCount} order${metrics.orderCount === 1 ? "" : "s"}`}
                icon={Wallet01Icon}
              />
            </Link>
            <Link href="#analytics-charts" className={CARD_LINK_CLASS}>
              <KpiStat
                label="Store conversion"
                value={`${metrics.conversionPct}%`}
                caption={`${metrics.sessions} session${metrics.sessions === 1 ? "" : "s"}`}
                icon={ChartAverageIcon}
              />
            </Link>
            <Link
              href="/supplier/dashboard/orders?status=new"
              className={CARD_LINK_CLASS}
            >
              <KpiStat
                label="New orders"
                value={metrics.newOrders.count}
                caption={formatRupees(metrics.newOrders.value)}
                icon={ShoppingCart01Icon}
              />
            </Link>
            <Link
              href="/supplier/dashboard/orders?status=new%2Cconfirmed"
              className={CARD_LINK_CLASS}
            >
              <KpiStat
                label="To ship"
                value={metrics.shipQueue.count}
                caption={formatRupees(metrics.shipQueue.value)}
                icon={DeliveryTruck01Icon}
              />
            </Link>
          </div>

          <div
            id="analytics-charts"
            className="grid scroll-mt-4 grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <Card>
              <CardHeader>
                <CardTitle>Sales</CardTitle>
                <CardDescription>
                  Revenue per{" "}
                  {metrics.salesSeries.length > 31 ? "month" : "day"} ·{" "}
                  {DASHBOARD_RANGE_LABELS[range].toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasSales ? (
                  <SalesChart data={metrics.salesSeries} />
                ) : (
                  <Empty>
                    <EmptyTitle>No sales in this range</EmptyTitle>
                    <EmptyDescription>
                      Orders placed in this period will appear here.
                    </EmptyDescription>
                  </Empty>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Conversion</CardTitle>
                <CardDescription>
                  Ordering sessions ÷ all store sessions ·{" "}
                  {DASHBOARD_RANGE_LABELS[range].toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasSessions ? (
                  <ConversionChart data={metrics.conversionSeries} />
                ) : (
                  <Empty>
                    <EmptyTitle>No store visits yet</EmptyTitle>
                    <EmptyDescription>
                      Share your store link to start tracking conversion.
                    </EmptyDescription>
                  </Empty>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <KpiStat
              label="Abandoned checkouts"
              value={metrics.abandonedCount}
              caption="Carts with no order in this period"
              icon={ShoppingCart01Icon}
            />
            <StoreLinkCard storePath={`/store/${company.id}`} />
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label="Total products"
          value={totalCount ?? 0}
          caption={`${monthCount ?? 0} added this month`}
          icon={Package01Icon}
        />
        <KpiStat
          label="Live listings"
          value={liveCount ?? 0}
          caption={
            verified ? "Visible to buyers" : "Unlocks after verification"
          }
          icon={ShieldCheckIcon}
        />
        <KpiStat
          label="Awaiting review"
          value={pendingCount ?? 0}
          caption="With our moderation team"
        />
        <KpiStat
          label="Needs changes"
          value={rejectedCount ?? 0}
          caption="Fix and resubmit"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <AttentionPanel
          title="Needs attention"
          description="Actionable items for your business."
          items={attention}
          className="lg:col-span-4"
        />
        <div className="flex flex-col gap-4 lg:col-span-3">
          <ProfileCompletionCard
            score={checklist.score}
            items={checklist.items}
          />
        </div>
      </div>

      <Card className="!gap-0 !pb-0">
        <CardHeader className="flex w-full flex-row items-center justify-between gap-2 border-b border-border">
          <div className="grid gap-0.5">
            <CardTitle>Recent products</CardTitle>
            <CardDescription>
              Your latest listings and their status.
            </CardDescription>
          </div>
          {verified ? (
            <Button
              render={<Link href="/supplier/dashboard/products" />}
              nativeButton={false}
              variant="outline"
              size="sm"
              className="[&_svg]:size-3.5"
            >
              View all
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="!px-0">
          {!recent || recent.length === 0 ? (
            <Empty className="!border-0">
              <EmptyTitle>No products yet</EmptyTitle>
              <EmptyDescription>
                {verified
                  ? "Create your first listing to start selling."
                  : "Products unlock once your business is verified."}
              </EmptyDescription>
              {verified ? (
                <Button
                  render={<Link href="/supplier/dashboard/products/new" />}
                  nativeButton={false}
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                  Add product
                </Button>
              ) : null}
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden sm:table-cell">Price</TableHead>
                  <TableHead className="hidden md:table-cell">MOQ</TableHead>
                  <TableHead className="hidden md:table-cell">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/supplier/dashboard/products/${p.id}/edit`}
                        className="block max-w-64 truncate font-medium hover:underline"
                      >
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      ₹{recentPricing.get(p.id)?.customer_price ?? 0} / {p.unit}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {p.moq}
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {p.stock_qty}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="product" value={p.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(p.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
