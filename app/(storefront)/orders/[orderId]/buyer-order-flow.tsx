"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { motion } from "motion/react"
import { springSnappy } from "@/lib/motion"
import {
  orderAtOrBeyond,
  parseOrderStatus,
  parsePaymentStatus,
} from "@/lib/orders/lifecycle"
import { formatRupees } from "@/lib/format"
import { QuoteResponseButtons } from "./quote-response-buttons"

/**
 * The buyer's order flow in one ordered column: order placed → respond to the
 * quotation → pay the supplier → shipment → delivered. Every buyer action
 * lives inside its step instead of being scattered across the detail cards,
 * so there is exactly one place telling them what to do next.
 *
 * Statuses and payment states come from the same lifecycle module the
 * database guard enforces; nothing here can offer an impossible action.
 */
export function BuyerOrderFlow({
  orderId,
  status,
  paymentStatus,
  paymentAmount,
  canPay,
  hasQuotation,
  pendingQuote,
}: {
  orderId: string
  status: string
  paymentStatus: string
  paymentAmount: number
  canPay: boolean
  hasQuotation: boolean
  /** The quotation awaiting a response, if one is out there. */
  pendingQuote: { id: string; totalLabel: string; expired: boolean } | null
}) {
  const orderStatus = parseOrderStatus(status)
  const payment = parsePaymentStatus(paymentStatus) ?? "not_requested"
  if (!orderStatus || orderStatus === "cancelled") {
    return null
  }

  const quoteDone = orderStatus !== "quoted"
  const paymentDone =
    payment === "paid" || orderAtOrBeyond(orderStatus, "delivered")
  const shipmentDone = orderAtOrBeyond(orderStatus, "shipped")
  const deliveredDone = orderAtOrBeyond(orderStatus, "delivered")

  const steps: StepDef[] = [
    {
      key: "placed",
      title: "Order placed",
      description:
        orderStatus === "new"
          ? "Sent to the supplier — waiting for their review."
          : "Your order is with the supplier.",
      done: true,
      body: null,
    },
    {
      key: "quotation",
      title: "Review quotation",
      description: quoteDone
        ? hasQuotation
          ? "Quotation settled."
          : "The supplier went ahead without a separate quotation."
        : !pendingQuote
          ? "Waiting for the supplier's quotation."
          : pendingQuote.expired
            ? "The quotation expired before you could respond."
            : "A quotation is waiting for your response.",
      done: quoteDone,
      body:
        !quoteDone && pendingQuote && !pendingQuote.expired ? (
          <QuoteResponseButtons
            orderId={orderId}
            quotationId={pendingQuote.id}
            totalLabel={pendingQuote.totalLabel}
          />
        ) : null,
    },
    {
      key: "payment",
      title: "Make payment",
      description: paymentDone
        ? payment === "paid"
          ? "Payment confirmed by the supplier."
          : "No payment outstanding on this order."
        : payment === "claimed"
          ? "Your reference is submitted — the supplier verifies it in their bank."
          : payment === "pending"
            ? "The supplier is awaiting your payment."
            : "Pay the supplier directly once they confirm or quote your order.",
      done: paymentDone,
      body:
        !paymentDone && canPay ? (
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/orders/${orderId}/pay`}
              className="inline-flex h-8 press items-center justify-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Pay {formatRupees(paymentAmount)}
            </Link>
            <span className="text-xs text-muted-foreground">
              Test-mode payment screen — no real money moves.
            </span>
          </div>
        ) : null,
    },
    {
      key: "shipment",
      title: "Await shipment",
      description: shipmentDone
        ? orderStatus === "delivered"
          ? "The shipment reached you."
          : "Shipped — carrier and tracking are on this order."
        : orderAtOrBeyond(orderStatus, "confirmed")
          ? "The supplier is preparing your order."
          : "Starts once the supplier confirms your order.",
      done: shipmentDone,
      body: null,
    },
    {
      key: "delivered",
      title: "Delivered",
      description: deliveredDone
        ? "The supplier has confirmed delivery of this order."
        : "Final step — delivery is confirmed here.",
      done: deliveredDone,
      body: null,
    },
  ]

  const currentIndex = steps.findIndex((step) => !step.done)

  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <h2 className="text-sm font-semibold">
          {currentIndex === -1 ? "Order flow complete" : "What happens next"}
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {currentIndex === -1
            ? `${steps.length} of ${steps.length} steps done`
            : `Step ${currentIndex + 1} of ${steps.length} · ${steps[currentIndex].title}`}
        </p>
      </header>

      <ol className="divide-y divide-border">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex
          return (
            <li
              key={step.key}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex gap-3 px-4 py-3",
                isCurrent && "bg-primary/[0.04]"
              )}
            >
              <span className="pt-0.5">
                <StepMarker
                  done={step.done}
                  current={isCurrent}
                  index={index}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.done ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {isCurrent ? (
                    <motion.span
                      layoutId="buyer-order-now"
                      transition={springSnappy}
                      className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground"
                    >
                      Now
                    </motion.span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.description}
                </p>
                {step.body ? <div className="mt-2.5">{step.body}</div> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

type StepDef = {
  key: string
  title: string
  description: string
  done: boolean
  body: React.ReactNode
}

function StepMarker({
  done,
  current,
  index,
}: {
  done: boolean
  current: boolean
  index: number
}) {
  if (done) {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-success text-white [&_svg]:size-3.5">
        <HugeiconsIcon icon={Tick01Icon} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums",
        current
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground"
      )}
    >
      {index + 1}
    </span>
  )
}
