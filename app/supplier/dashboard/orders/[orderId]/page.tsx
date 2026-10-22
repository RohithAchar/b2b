import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { formatRupees } from "@/lib/format";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { OrderItems } from "@/components/orders/order-items";
import { OrderProgress } from "@/components/orders/order-progress";
import { OrderNotifications } from "@/components/orders/order-notifications";
import type { DeliverySnapshot } from "@/lib/orders/delivery";
import { getOrderItemImages } from "@/lib/orders/item-images";
import type {
  OrderStatus,
  PaymentStatus,
} from "@/lib/orders/lifecycle";
import { OrderActionsPanel } from "./order-actions-panel";

export const metadata: Metadata = { title: "Order details" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDateTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventLabel(event: { event: string; data: Record<string, unknown> }): string {
  switch (event.event) {
    case "order_created":
      return "Order placed by the buyer";
    case "status_changed":
      return `Status: ${String(event.data.from)} → ${String(event.data.to)}`;
    case "payment_status_changed":
      return `Payment: ${String(event.data.from)} → ${String(event.data.to)}`;
    case "order_cancelled":
      return event.data.reason
        ? `Order cancelled — ${String(event.data.reason)}`
        : "Order cancelled";
    default:
      return event.event;
  }
}

type OrderRow = {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  item_count: number;
  delivery: DeliverySnapshot | null;
  buyer_note: string | null;
  supplier_note: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  carrier: string | null;
  tracking_ref: string | null;
  shipment_notes: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  payment_confirmed_by: string | null;
  payment_confirmed_at: string | null;
  payment_claim_reference: string | null;
  payment_claimed_at: string | null;
  created_at: string;
};

type ItemRow = {
  id: string;
  product_id: string | null;
  title: string;
  variant_label: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
};

type QuotationRow = {
  id: string;
  version: number;
  status: string;
  subtotal: number;
  delivery_charge: number;
  tax_amount: number;
  total: number;
  note: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  event: string;
  data: Record<string, unknown>;
  created_at: string;
};

export default async function SupplierOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    notFound();
  }

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

  // Ownership is enforced here (explicit company scope) and again by RLS.
  // A foreign order id 404s — no data, no confirmation it exists.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, reference, status, payment_status, subtotal, discount, item_count, delivery, buyer_note, supplier_note, rejection_reason, rejected_at, carrier, tracking_ref, shipment_notes, shipped_at, delivered_at, cancelled_at, payment_confirmed_by, payment_confirmed_at, payment_claim_reference, payment_claimed_at, created_at",
    )
    .eq("id", orderId)
    .eq("supplier_id", ctx.companyId)
    .maybeSingle();

  if (!order) {
    notFound();
  }

  const [{ data: items }, { data: events }, { data: quotations }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_id, title, variant_label, unit, quantity, unit_price")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_events")
      .select("id, event, data, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("quotations")
      .select(
        "id, version, status, subtotal, delivery_charge, tax_amount, total, note, expires_at, accepted_at, created_at",
      )
      .eq("order_id", orderId)
      .order("version", { ascending: true }),
  ]);

  const quoteIds = (quotations ?? []).map((q) => q.id as string);
  const orderItemsForImages = (items ?? []) as unknown as ItemRow[];
  const [{ data: quotationItems }, itemImages] = await Promise.all([
    quoteIds.length > 0
      ? supabase
          .from("quotation_items")
          .select(
            "id, quotation_id, title, variant_label, unit, quantity, unit_price, line_total",
          )
          .in("quotation_id", quoteIds)
      : Promise.resolve({ data: [] as unknown[] }),
    getOrderItemImages(
      supabase,
      orderItemsForImages.map((item) => item.product_id),
    ),
  ]);

  const orderRow = order as unknown as OrderRow;
  const delivery = orderRow.delivery;
  const quoteRows = (quotations ?? []) as unknown as QuotationRow[];
  const acceptedQuote =
    quoteRows.filter((quote) => quote.status === "accepted").at(-1) ?? null;
  const orderItems = orderItemsForImages;
  const quoteItemRows = (quotationItems ?? []) as unknown as {
    id: string;
    quotation_id: string;
    title: string;
    variant_label: string | null;
    unit: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            render={<Link href="/supplier/dashboard/orders" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            Orders
          </Button>
          <h1 className="text-xl font-bold tracking-tight tabular-nums">
            {orderRow.reference}
          </h1>
          <StatusBadge status="order" value={orderRow.status} />
          <StatusBadge status="payment" value={orderRow.payment_status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Placed {formatDateTime(orderRow.created_at)}
        </p>
      </div>

      <Card className="rounded-lg p-4">
        <OrderProgress
          status={orderRow.status as OrderStatus}
          paymentStatus={orderRow.payment_status as PaymentStatus}
          hasQuotation={
            orderRow.status !== "new" || quoteRows.length > 0
          }
          cancelledReason={orderRow.rejection_reason}
        />
      </Card>

      <OrderActionsPanel
        orderId={orderRow.id}
        status={orderRow.status}
        paymentStatus={orderRow.payment_status}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Buyer + delivery ------------------------------------------------------ */}
        <Card className="rounded-lg p-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Delivery</CardTitle>
            <CardDescription>Needed to fulfil this order.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {delivery ? (
              <div className="mt-2 flex flex-col gap-1 text-sm">
                <p className="font-semibold">{delivery.fullName}</p>
                <p className="text-muted-foreground">{delivery.phone}</p>
                <p className="text-muted-foreground">
                  {delivery.line1}
                  {delivery.line2 ? `, ${delivery.line2}` : ""}, {delivery.city},{" "}
                  {delivery.state} — {delivery.pincode}
                </p>
                {delivery.instructions ? (
                  <p className="text-xs text-muted-foreground">
                    Delivery note: {delivery.instructions}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No delivery address recorded (legacy order).
              </p>
            )}
          </CardContent>
        </Card>

        {/* Money + payment ------------------------------------------------------- */}
        <Card className="rounded-lg p-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Amount & payment</CardTitle>
            <CardDescription>
              Buyers pay you directly — the platform never handles money.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order value</span>
                <span className="font-bold tabular-nums">
                  {formatRupees(Number(orderRow.subtotal))}
                </span>
              </div>
              {Number(orderRow.discount) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coupon discount</span>
                  <span className="tabular-nums">
                    −{formatRupees(Number(orderRow.discount))}
                  </span>
                </div>
              ) : null}
              {acceptedQuote ? (
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium">
                    Agreed total (quotation v{acceptedQuote.version})
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatRupees(Number(acceptedQuote.total))}
                  </span>
                </div>
              ) : null}
              {orderRow.payment_status === "claimed" ? (
                <div className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-2.5">
                  <p className="text-xs font-semibold text-warning">
                    Buyer submitted a payment claim
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {orderRow.payment_claim_reference ?? "No reference"}
                  </p>
                  {orderRow.payment_claimed_at ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Submitted {formatDateTime(orderRow.payment_claimed_at)}. Verify it in
                      your bank/UPI, then confirm or report it as not received.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {orderRow.payment_confirmed_at ? (
                <p className="text-xs text-success">
                  Payment confirmed by you on {formatDateTime(orderRow.payment_confirmed_at)}.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items ------------------------------------------------------------------- */}
      <Card className="!gap-0 !pb-0 rounded-lg">
        <CardHeader className="border-b border-border">
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {orderRow.item_count} unit{orderRow.item_count === 1 ? "" : "s"} ordered
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          <OrderItems
            items={orderItems.map((item) => ({
              id: item.id,
              title: item.title,
              variantLabel: item.variant_label,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: Number(item.unit_price),
              imageUrl: item.product_id
                ? itemImages.get(item.product_id) ?? null
                : null,
            }))}
          />
        </CardContent>
      </Card>

      {/* Summary ---------------------------------------------------------------- */}
      <Card className="rounded-lg p-4">
        <div className="flex flex-col gap-1.5 text-sm">
          <p className="text-sm font-semibold">Summary</p>
          {acceptedQuote ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Items subtotal</span>
                <span className="tabular-nums">
                  {formatRupees(Number(acceptedQuote.subtotal))}
                </span>
              </div>
              {Number(acceptedQuote.delivery_charge) > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="tabular-nums">
                    {formatRupees(Number(acceptedQuote.delivery_charge))}
                  </span>
                </div>
              ) : null}
              {Number(acceptedQuote.tax_amount) > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">
                    {formatRupees(Number(acceptedQuote.tax_amount))}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">
                  Agreed total (quotation v{acceptedQuote.version})
                </span>
                <span className="font-bold tabular-nums">
                  {formatRupees(Number(acceptedQuote.total))}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Items subtotal</span>
                <span className="tabular-nums">
                  {formatRupees(Number(orderRow.subtotal))}
                </span>
              </div>
              {Number(orderRow.discount) > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Coupon discount</span>
                  <span className="tabular-nums">
                    −{formatRupees(Number(orderRow.discount))}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">Total</span>
                <span className="font-bold tabular-nums">
                  {formatRupees(
                    Number(orderRow.subtotal) - Number(orderRow.discount),
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Notes + rejections ------------------------------------------------------ */}
      {(orderRow.buyer_note || orderRow.rejection_reason || orderRow.shipment_notes) && (
        <Card className="rounded-lg p-4">
          <div className="flex flex-col gap-3 text-sm">
            {orderRow.buyer_note ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Buyer&apos;s note
                </p>
                <p className="mt-1">{orderRow.buyer_note}</p>
              </div>
            ) : null}
            {orderRow.rejection_reason ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Rejection reason (given {formatDateTime(orderRow.rejected_at)})
                </p>
                <p className="mt-1">{orderRow.rejection_reason}</p>
              </div>
            ) : null}
            {orderRow.shipment_notes ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shipment notes
                </p>
                <p className="mt-1">
                  {orderRow.shipment_notes}
                  {orderRow.carrier ? ` · ${orderRow.carrier}` : ""}
                  {orderRow.tracking_ref ? ` · ${orderRow.tracking_ref}` : ""}
                  {orderRow.shipped_at ? ` · shipped ${formatDateTime(orderRow.shipped_at)}` : ""}
                </p>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {/* Quotations -------------------------------------------------------------- */}
      <Card className="!gap-0 !pb-0 rounded-lg">
        <CardHeader className="border-b border-border">
          <CardTitle>Quotations</CardTitle>
          <CardDescription>
            {quoteRows.length === 0
              ? "No quotations yet. If final charges need confirming, send one so the buyer can approve."
              : "Newest revision last. The buyer accepts a specific version."}
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          {quoteRows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No quotations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Sent</TableHead>
                  <TableHead className="text-right tabular-nums">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quoteRows.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="tabular-nums">v{quote.version}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          quote.status === "accepted"
                            ? "success"
                            : quote.status === "rejected"
                              ? "destructive"
                              : quote.status === "expired"
                                ? "warning"
                                : "secondary"
                        }
                      >
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDateTime(quote.created_at)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatRupees(Number(quote.total))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {quoteItemRows.length > 0 ? (
            <div className="border-t border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Latest revision lines
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {quoteItemRows
                  .filter(
                    (item) =>
                      item.quotation_id ===
                      quoteRows[quoteRows.length - 1]?.id,
                  )
                  .map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {item.title}
                        {item.variant_label ? ` — ${item.variant_label}` : ""} ×{" "}
                        {item.quantity} {item.unit}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatRupees(Number(item.line_total))}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Notifications ---------------------------------------------------------- */}
      <OrderNotifications orderId={orderRow.id} />

      {/* History ----------------------------------------------------------------- */}
      <Card className="rounded-lg p-4">
        <CardHeader className="p-0">
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {((events ?? []) as unknown as EventRow[]).map((event) => (
              <li key={event.id} className="flex flex-col">
                <span>{eventLabel(event)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(event.created_at)}
                </span>
              </li>
            ))}
            {((events ?? []) as unknown as EventRow[]).length === 0 ? (
              <li className="text-muted-foreground">No events recorded.</li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}
