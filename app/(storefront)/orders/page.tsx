import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Package01Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { StatusFilterChip } from "@/components/orders/status-filter-chip"
import { OrderListSkeleton } from "@/components/storefront/skeletons"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getBuyerOrders } from "@/lib/buyer/order-history"
import { formatRupees } from "@/lib/format"

export const metadata: Metadata = {
  title: "My Orders",
  description: "Track every order you have placed on this marketplace.",
  robots: { index: false, follow: false },
}

const BASE = "/orders"

// Buyer-friendly groupings rather than the raw lifecycle vocabulary.
const ORDER_TABS = [
  { key: "all", label: "All Orders" },
  { key: "pending", label: "With supplier" },
  { key: "active", label: "In progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
] as const

type TabKey = (typeof ORDER_TABS)[number]["key"]

const TAB_STATUSES: Record<Exclude<TabKey, "all">, string[]> = {
  pending: ["new", "quoted"],
  active: ["confirmed", "processing", "shipped"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
}

function isTabKey(value: string): value is TabKey {
  return ORDER_TABS.some((tab) => tab.key === value)
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default async function BuyerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) {
    redirect("/auth/login?next=/orders")
  }

  const { status } = await searchParams
  const activeTab: TabKey = status && isTabKey(status) ? status : "all"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track every order you have placed, newest first.
        </p>
      </div>

      {/* Filter counts and the list both need the order rows, so they stream
          together while the heading above renders immediately. */}
      <Suspense fallback={<OrderListSkeleton header={false} />}>
        <BuyerOrdersSection userId={user.id} activeTab={activeTab} />
      </Suspense>
    </div>
  )
}

async function BuyerOrdersSection({
  userId,
  activeTab,
}: {
  userId: string
  activeTab: TabKey
}) {
  const supabase = await createClient()
  const orders = await getBuyerOrders(supabase, userId)
  const shown =
    activeTab === "all"
      ? orders
      : orders.filter((order) => TAB_STATUSES[activeTab].includes(order.status))

  const countFor = (key: TabKey) =>
    key === "all"
      ? orders.length
      : orders.filter((order) => TAB_STATUSES[key].includes(order.status))
          .length

  return (
    <>
      <nav aria-label="Order status" className="flex flex-wrap gap-2">
        {ORDER_TABS.map((tab) => (
          <StatusFilterChip
            key={tab.key}
            href={tab.key === "all" ? BASE : `${BASE}?status=${tab.key}`}
            label={tab.label}
            count={countFor(tab.key)}
            active={activeTab === tab.key}
            layoutId="buyer-orders-filter"
          />
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
            <HugeiconsIcon icon={ShoppingBag01Icon} strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-base font-semibold">No orders here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeTab === "all"
                ? "Orders you place will appear here."
                : "No orders in this group right now."}
            </p>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((order) => (
            <li key={order.id}>
              <Link
                href={`${BASE}/${order.id}`}
                className="flex press flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-md sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
                    <HugeiconsIcon icon={Package01Icon} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm font-semibold">
                      {order.reference}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {order.supplierName ?? "Supplier"} ·{" "}
                      {formatDate(order.createdAt)}
                    </span>
                  </span>
                </span>

                <span className="flex items-center justify-between gap-3 sm:justify-end sm:gap-6">
                  <span className="text-right text-xs text-muted-foreground">
                    {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                    <span className="block text-sm font-bold text-foreground tabular-nums">
                      {formatRupees(order.total)}
                    </span>
                  </span>
                  <StatusBadge status="order" value={order.status} />
                  <span className="hidden items-center gap-1 text-xs font-medium text-primary sm:inline-flex">
                    View details
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                      className="size-3.5"
                    />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
