"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { publicImageUrl } from "@/lib/storage"
import {
  MIN_CART_VALUE,
  formatRupees,
  type CartSupplierGroup,
} from "@/lib/buyer/cart"
import {
  CartCouponBox,
  type AppliedCoupon,
} from "@/components/storefront/cart-coupon-box"
import { CartLineControls } from "./cart-line-controls"

/**
 * Cart grouped by supplier, each with its own coupon box. Applied discounts
 * are summed into the order summary; the ₹2,500 gate still reads the
 * pre-discount subtotal, and checkout revalidates every code.
 */
export function CartGroups({
  groups,
  savedCoupons,
  subtotal,
  meetsMinimum,
  shortfall,
  unavailableCount,
}: {
  groups: CartSupplierGroup[]
  /** Persisted coupon codes by supplier, hydrated into each box on load. */
  savedCoupons: Record<string, string>
  subtotal: number
  meetsMinimum: boolean
  shortfall: number
  unavailableCount: number
}) {
  const [applied, setApplied] = useState<Record<string, AppliedCoupon>>({})

  const onDiscountChange = useCallback(
    (supplierId: string, quote: AppliedCoupon | null) => {
      setApplied((prev) => {
        if (!quote) {
          if (!(supplierId in prev)) return prev
          const next = { ...prev }
          delete next[supplierId]
          return next
        }
        if (
          prev[supplierId]?.code === quote.code &&
          prev[supplierId]?.discount === quote.discount
        ) {
          return prev
        }
        return { ...prev, [supplierId]: quote }
      })
    },
    []
  )

  const savings = groups.reduce(
    (sum, group) => sum + (applied[group.supplierId]?.discount ?? 0),
    0
  )
  const progress = Math.min(100, Math.round((subtotal / MIN_CART_VALUE) * 100))

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-5">
        {unavailableCount > 0 && (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {unavailableCount} item{unavailableCount > 1 ? "s were" : " was"}{" "}
            removed because {unavailableCount > 1 ? "they are" : "it is"} no
            longer available.
          </p>
        )}
        {groups.map((group) => (
          <section
            key={group.supplierId}
            aria-label={`Items from ${group.supplierName}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              {group.supplierId === "unknown" ? (
                <span className="truncate text-sm font-bold tracking-tight">
                  {group.supplierName}
                </span>
              ) : (
                <Link
                  href={`/store/${group.supplierId}`}
                  className="truncate text-sm font-bold tracking-tight hover:text-primary hover:underline"
                >
                  {group.supplierName}
                </Link>
              )}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {group.lines.length} item{group.lines.length > 1 ? "s" : ""} ·{" "}
                {formatRupees(group.subtotal)}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-3">
              {group.lines.map((line) => (
                <Card key={line.cartItemId} className="rounded-lg p-4">
                  <div className="flex gap-3">
                    <Link
                      href={`/products/${line.productId}`}
                      aria-label={`View ${line.title}`}
                      className="relative size-20 shrink-0 press overflow-hidden rounded-md border border-border bg-muted"
                    >
                      {line.imagePath ? (
                        <Image
                          src={publicImageUrl("product_images", line.imagePath)}
                          alt={line.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${line.productId}`}
                        className="block truncate text-sm font-semibold hover:text-primary"
                      >
                        {line.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatRupees(line.unitPrice)} / {line.unit} · MOQ:{" "}
                        {line.moq}
                      </p>
                      {line.quantity > line.stockQty && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Only {line.stockQty} in stock
                        </p>
                      )}
                      {line.quantity < line.moq && (
                        <p className="mt-0.5 text-xs font-medium text-warning">
                          Minimum order is {line.moq} {line.unit} — increase the
                          quantity.
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <CartLineControls
                          cartItemId={line.cartItemId}
                          quantity={line.quantity}
                          moq={line.moq}
                        />
                        <p className="text-sm font-bold tabular-nums">
                          {formatRupees(line.lineTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-2">
              <CartCouponBox
                supplierId={group.supplierId}
                fingerprint={JSON.stringify(
                  group.lines.map((line) => [
                    line.cartItemId,
                    line.quantity,
                    line.lineTotal,
                  ])
                )}
                savedCode={savedCoupons[group.supplierId] ?? null}
                onDiscountChange={onDiscountChange}
              />
            </div>
          </section>
        ))}
      </div>

      <Card className="h-fit rounded-lg p-4 lg:sticky lg:top-32">
        <p className="text-sm font-semibold">Order summary</p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-bold tabular-nums">
            {formatRupees(subtotal)}
          </span>
        </div>
        {savings > 0 && (
          <>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Coupon savings</span>
              <span className="font-bold text-success tabular-nums">
                −{formatRupees(savings)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold">Total</span>
              <span className="font-bold tabular-nums">
                {formatRupees(subtotal - savings)}
              </span>
            </div>
          </>
        )}
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to minimum cart value"
            className="h-2 overflow-hidden rounded-sm bg-muted"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
          {meetsMinimum ? (
            <p className="mt-2 text-xs font-medium text-success">
              Minimum met — you can check out.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Add {formatRupees(shortfall)} more to reach the{" "}
              {formatRupees(MIN_CART_VALUE)} minimum.
            </p>
          )}
        </div>
        {meetsMinimum ? (
          <Link href="/checkout" className="mt-4 block">
            <Button size="lg" className="w-full">
              Proceed to Checkout
            </Button>
          </Link>
        ) : (
          <Button disabled size="lg" className="mt-4 w-full">
            {`Checkout · min ${formatRupees(MIN_CART_VALUE)}`}
          </Button>
        )}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Prices include applicable slabs and are confirmed at checkout.
        </p>
      </Card>
    </div>
  )
}
