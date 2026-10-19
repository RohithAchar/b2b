"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { formatRupees } from "@/lib/format"

export type SupplierOrderListItem = {
  id: string
  reference: string
  status: string
  paymentStatus: string
  subtotal: number
  itemCount: number
  buyerName: string | null
  createdAt: string
  updatedAt: string
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function SupplierOrdersTable({
  orders,
  basePath,
}: {
  orders: SupplierOrderListItem[]
  basePath: string
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()

  const rows = useMemo(
    () =>
      q
        ? orders.filter(
            (order) =>
              order.reference.toLowerCase().includes(q) ||
              (order.buyerName ?? "").toLowerCase().includes(q)
          )
        : orders,
    [orders, q]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative w-full max-w-xs">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search order or buyer"
            aria-label="Search orders"
            className="pl-9"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {rows.length} of {orders.length} shown
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No orders match your search.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Order</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right tabular-nums">
                    Items
                  </TableHead>
                  <TableHead className="text-right tabular-nums">
                    Amount
                  </TableHead>
                  <TableHead>Order status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  <TableRow
                    key={order.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <TableCell>
                      <Link
                        href={`${basePath}/${order.id}`}
                        className="font-mono text-xs font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {order.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">
                      {order.buyerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {order.itemCount}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatRupees(order.subtotal)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="order" value={order.status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status="payment"
                        value={order.paymentStatus}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        render={<Link href={`${basePath}/${order.id}`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        View
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          strokeWidth={2}
                          data-icon="inline-end"
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((order) => (
              <li key={order.id}>
                <Link
                  href={`${basePath}/${order.id}`}
                  className="flex press flex-col gap-3 rounded-lg border border-border bg-card p-4 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">
                        {order.reference}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.buyerName ?? "Buyer"} ·{" "}
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status="order" value={order.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                    </span>
                    <span className="font-bold tabular-nums">
                      {formatRupees(order.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status="payment" value={order.paymentStatus} />
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      View order
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-3.5"
                      />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
