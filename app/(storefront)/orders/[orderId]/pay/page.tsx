import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import QRCode from "qrcode"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { formatRupees } from "@/lib/format"
import { orderAmount } from "@/lib/orders/quotation"
import {
  PAYMENT_STATUS_LABELS,
  canBuyerClaimPayment,
  parseOrderStatus,
  parsePaymentStatus,
} from "@/lib/orders/lifecycle"
import {
  TEST_UPI_CONFIGURED,
  TEST_UPI_ID,
  buildUpiUri,
  isPayableAmount,
  testPaymentNote,
} from "@/lib/orders/test-payment"
import { CopyUpiButton } from "./copy-upi-button"
import { PaymentClaimForm } from "./payment-claim-form"

export const metadata: Metadata = { title: "Pay supplier (test mode)" }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function formatDateTime(value: string | null): string {
  if (!value) return ""
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type OrderRow = {
  id: string
  reference: string
  status: string
  payment_status: string
  subtotal: number
  discount: number
  payment_claim_reference: string | null
  payment_claimed_at: string | null
}

export default async function PaySupplierPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  if (!UUID_RE.test(orderId)) {
    notFound()
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) {
    redirect(`/auth/login?next=/orders/${orderId}/pay`)
  }

  const [
    { data: order },
    { data: acceptedQuote },
    { data: contact },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, reference, status, payment_status, subtotal, discount, payment_claim_reference, payment_claimed_at"
      )
      .eq("id", orderId)
      .eq("buyer_id", user.id)
      .maybeSingle(),
    supabase
      .from("quotations")
      .select("status, total, version")
      .eq("order_id", orderId)
      .eq("status", "accepted")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("order_supplier_contact")
      .select("supplier_name")
      .eq("order_id", orderId)
      .maybeSingle(),
  ])
  if (!order) {
    notFound()
  }
  const orderRow = order as unknown as OrderRow

  const quote = acceptedQuote as { status: string; total: number; version: number } | null
  const amount = orderAmount(orderRow.subtotal, quote)
  const status = parseOrderStatus(orderRow.status) ?? "new"
  const payment = parsePaymentStatus(orderRow.payment_status) ?? "not_requested"
  const supplierName =
    (contact as { supplier_name?: string } | null)?.supplier_name ??
    "the supplier"

  const paymentActionable =
    payment === "pending" ||
    Boolean(quote) ||
    status === "confirmed" ||
    status === "processing" ||
    status === "shipped"
  const payable =
    canBuyerClaimPayment(status, payment) &&
    paymentActionable &&
    isPayableAmount(amount)
  const configMissing = !TEST_UPI_CONFIGURED
  const canShowPayment = payable && !configMissing
  const upiUri = canShowPayment
    ? buildUpiUri({ reference: orderRow.reference, amount })
    : null
  const qrDataUrl = upiUri
    ? await QRCode.toDataURL(upiUri, { width: 240, margin: 1 })
    : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          render={<Link href={`/orders/${orderRow.id}`} />}
          nativeButton={false}
          variant="outline"
          size="sm"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Order {orderRow.reference}
        </Button>
        <Badge variant={payment === "paid" ? "success" : "outline"}>
          Payment: {PAYMENT_STATUS_LABELS[payment]}
        </Badge>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            Pay {supplierName}
          </h1>
          <Badge variant="warning">Test mode</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay the supplier directly, then record the reference so they can
          verify it. This platform never collects money.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          <p className="font-semibold">Test mode — no real money moves</p>
          <p className="mt-1">
            This screen uses a configurable test UPI id. Paying it does not
            transfer money to the supplier. The claim and the supplier&apos;s
            confirmation are recorded so the workflow can be tested end to end.
          </p>
        </AlertDescription>
      </Alert>

      {configMissing ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-semibold">Payment details are not configured</p>
            <p className="mt-1">
              No test UPI id is set for this environment, so payment is
              disabled. Set{" "}
              <span className="font-mono">NEXT_PUBLIC_TEST_UPI_ID</span> to
              enable the test payment screen.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="!gap-0 !pb-0">
        <CardHeader className="border-b border-border">
          <CardTitle>Amount due</CardTitle>
          <CardDescription>
            {quote
              ? `Agreed on quotation v${quote.version}`
              : "Order total as placed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 p-4">
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {formatRupees(amount)}
          </p>

          {canShowPayment && upiUri && qrDataUrl ? (
            <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
              <div className="w-fit rounded-md border border-border bg-card p-2">
                {/* Server-generated QR data URL; no remote image host. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`UPI QR code for ${formatRupees(amount)}`}
                  width={240}
                  height={240}
                  className="size-60"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Test UPI id
                  </p>
                  <p className="mt-1 font-mono text-sm break-all">
                    {TEST_UPI_ID}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Payment note: {testPaymentNote(orderRow.reference)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    render={<a href={upiUri} />}
                    nativeButton={false}
                    variant="outline"
                    size="sm"
                  >
                    Open UPI app
                  </Button>
                  <CopyUpiButton value={TEST_UPI_ID} />
                </div>
              </div>
            </div>
          ) : null}

          {canShowPayment ? (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-sm font-semibold">Already paid?</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Enter the reference from your UPI app. The supplier must confirm
                receipt before the order is marked paid.
              </p>
              <PaymentClaimForm orderId={orderRow.id} />
            </div>
          ) : (
            <div className="border-t border-border pt-4 text-sm">
              {payment === "claimed" ? (
                <>
                  <p className="font-medium">
                    Payment submitted — awaiting verification
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Reference{" "}
                    <span className="font-mono">
                      {orderRow.payment_claim_reference ?? "—"}
                    </span>
                    {orderRow.payment_claimed_at
                      ? ` submitted ${formatDateTime(orderRow.payment_claimed_at)}`
                      : ""}
                    . The supplier will confirm receipt.
                  </p>
                </>
              ) : payment === "paid" ? (
                <>
                  <p className="font-medium text-success">Payment confirmed</p>
                  <p className="mt-1 text-muted-foreground">
                    The supplier has verified receipt for this order.
                  </p>
                </>
              ) : status === "cancelled" ? (
                <p className="text-muted-foreground">
                  This order was cancelled, so there is nothing to pay.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  There is no payable amount on this order right now.
                </p>
              )}
              <Button
                render={<Link href={`/orders/${orderRow.id}`} />}
                nativeButton={false}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Back to order
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
