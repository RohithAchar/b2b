"use client"

import { useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Ticket01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { formatRupees } from "@/lib/format"
import {
  clearCartCoupon,
  quoteCoupon,
  saveCartCoupon,
} from "@/lib/buyer/cart-actions"

export type AppliedCoupon = {
  code: string
  discount: number
  description: string
}

/**
 * Per-supplier coupon box. Validates live against the server (which
 * recomputes the group subtotal) and revalidates silently whenever the
 * group's lines change, so quantity edits can never leave a stale discount
 * on screen. Applied codes persist in the database and are hydrated on
 * load; discounts are always re-derived, never stored. Everything is
 * rechecked again at checkout.
 */
export function CartCouponBox({
  supplierId,
  fingerprint,
  savedCode,
  onDiscountChange,
}: {
  supplierId: string
  /** Signature of the group's lines; changes trigger silent revalidation. */
  fingerprint: string
  /** Code persisted from an earlier visit; hydrated on mount. */
  savedCode: string | null
  onDiscountChange: (supplierId: string, applied: AppliedCoupon | null) => void
}) {
  const [code, setCode] = useState("")
  const [applied, setApplied] = useState<AppliedCoupon | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const firstRender = useRef(true)
  const hydrated = useRef(false)

  // Hydrate a persisted code once on mount. A code that no longer validates
  // (expired, capped out, deactivated) is dropped along with its saved row.
  useEffect(() => {
    if (hydrated.current || !savedCode) return
    hydrated.current = true
    void (async () => {
      const quote = await quoteCoupon(supplierId, savedCode)
      if (quote.ok) {
        const next = {
          code: quote.code,
          discount: quote.discount,
          description: quote.description,
        }
        setApplied(next)
        onDiscountChange(supplierId, next)
      } else {
        setError(quote.message)
        void clearCartCoupon(supplierId)
      }
    })()
    // Mount-only hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (!applied) return
    let cancelled = false
    const stale = applied
    void (async () => {
      const quote = await quoteCoupon(supplierId, stale.code)
      if (cancelled) return
      if (quote.ok) {
        const next = {
          code: quote.code,
          discount: quote.discount,
          description: quote.description,
        }
        setApplied(next)
        onDiscountChange(supplierId, next)
      } else {
        setApplied(null)
        setError(quote.message)
        onDiscountChange(supplierId, null)
        void clearCartCoupon(supplierId)
      }
    })()
    return () => {
      cancelled = true
    }
    // Revalidate only when the cart lines change — never on parent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint])

  const apply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !code.trim()) {
      if (!code.trim()) setError("Enter a coupon code.")
      return
    }
    setBusy(true)
    setError(null)
    const quote = await quoteCoupon(supplierId, code)
    setBusy(false)
    if (quote.ok) {
      const next = {
        code: quote.code,
        discount: quote.discount,
        description: quote.description,
      }
      setApplied(next)
      setCode("")
      onDiscountChange(supplierId, next)
      void saveCartCoupon(supplierId, next.code)
    } else {
      setError(quote.message)
    }
  }

  const remove = () => {
    setApplied(null)
    setError(null)
    onDiscountChange(supplierId, null)
    void clearCartCoupon(supplierId)
  }

  if (applied) {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
            <HugeiconsIcon
              icon={Ticket01Icon}
              strokeWidth={2}
              className="size-4 shrink-0 text-success"
            />
            <span className="truncate">{applied.code}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-bold text-success tabular-nums">
              −{formatRupees(applied.discount)}
            </span>
            <button
              type="button"
              onClick={remove}
              aria-label={`Remove coupon ${applied.code}`}
              className="flex min-h-8 min-w-8 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                className="size-4"
              />
            </button>
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {applied.description}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={apply} className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            if (error) setError(null)
          }}
          placeholder="Coupon code"
          autoComplete="off"
          aria-label="Coupon code for this store"
          className="h-8 tracking-wide uppercase placeholder:normal-case"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={busy}
          className="shrink-0"
        >
          {busy ? (
            <>
              <Spinner data-icon="inline-start" />
              Checking…
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
