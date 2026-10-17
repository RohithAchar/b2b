import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CallIcon,
  TruckDeliveryIcon,
} from "@hugeicons/core-free-icons";
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
import { getSessionUser } from "@/lib/auth/session";
import { formatRupees } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  parseOrderStatus,
  parsePaymentStatus,
} from "@/lib/orders/lifecycle";
import {
  type DeliverySnapshot,
} from "@/lib/orders/delivery";
import {
  contactMessage,
  whatsappContactLink,
} from "@/lib/orders/whatsapp-link";
import { QuoteResponseButtons } from "./quote-response-buttons";
import { OrderNotifications } from "@/components/orders/order-notifications";

export const metadata: Metadata = { title: "Order details" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  new: "secondary",
  quoted: "secondary",
  confirmed: "default",
  processing: "default",
  shipped: "default",
  delivered: "outline",
  cancelled: "outline",
};

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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Module-level so render stays pure under the React compiler lint rules. */
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/** Buyer-facing phrasing for the immutable event trail. */
function eventLabel(event: {
  event: string;
  data: Record<string, unknown>;
}): string {
  switch (event.event) {
    case "order_created":
      return "You placed this order";
    case "status_changed": {
      const to = String(event.data.to);
      switch (to) {
        case "quoted":
          return "Supplier sent a quotation";
        case "confirmed":
          return "Supplier confirmed the order";
        case "processing":
          return "Supplier started processing";
        case "shipped":
          return "Order shipped";
        case "delivered":
          return "Order delivered";
        case "cancelled":
          return "Order cancelled";
        case "new":
          return "Back with the supplier for review";
        default:
          return `Status: ${to}`;
      }
    }
    case "payment_status_changed":
      return String(event.data.to) === "paid"
        ? "Supplier confirmed payment received"
        : "Payment status updated by supplier";
    case "order_cancelled":
      return event.data.reason
        ? `Order cancelled — ${String(event.data.reason)}`
        : "Order cancelled";
    case "quotation_created":
      return `Supplier sent quotation v${String(event.data.version)}`;
    case "quotation_accepted":
      return `You accepted quotation v${String(event.data.version)}`;
    case "quotation_rejected":
      return `You rejected quotation v${String(event.data.version)}`;
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
  rejection_reason: string | null;
  carrier: string | null;
  tracking_ref: string | null;
  shipment_notes: string | null;
  shipped_at: string | null;
  created_at: string;
};

type ItemRow = {
  id: string;
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

type QuotationItemRow = {
  quotation_id: string;
  title: string;
  variant_label: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const QUOTE_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending: { label: "Awaiting your response", variant: "default" },
  accepted: { label: "Accepted", variant: "default" },
  rejected: { label: "Rejected", variant: "outline" },
  expired: { label: "Expired", variant: "outline" },
  superseded: { label: "Superseded", variant: "outline" },
};

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
};

export default async function BuyerOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!UUID_RE.test(orderId)) {
    notFound();
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    redirect(`/auth/login?next=/orders/${orderId}`);
  }

  // RLS scopes orders to their buyer; the explicit filter keeps intent clear.
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, reference, status, payment_status, subtotal, discount, item_count, delivery, buyer_note, rejection_reason, carrier, tracking_ref, shipment_notes, shipped_at, created_at",
    )
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!order) {
    notFound();
  }
  const orderRow = order as unknown as OrderRow;
  const status = parseOrderStatus(orderRow.status) ?? "new";
  const delivery = orderRow.delivery;

  const [{ data: items }, { data: quotations }, { data: events }, { data: contact }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("id, title, variant_label, unit, quantity, unit_price")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase
        .from("quotations")
        .select(
          "id, version, status, subtotal, delivery_charge, tax_amount, total, note, expires_at, accepted_at, created_at",
        )
        .eq("order_id", orderId)
        .order("version", { ascending: true }),
      supabase
        .from("order_events")
        .select("id, event, data, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      // SECURITY DEFINER view — rows exist only for this buyer's own orders.
      supabase
        .from("order_supplier_contact")
        .select("supplier_name, phone")
        .eq("order_id", orderId)
        .maybeSingle(),
    ]);

  const orderItems = (items ?? []) as unknown as ItemRow[];
  const quoteRows = (quotations ?? []) as unknown as QuotationRow[];

  const quoteIds = quoteRows.map((quote) => quote.id);
  const { data: quotationItemRows } =
    quoteIds.length > 0
      ? await supabase
          .from("quotation_items")
          .select(
            "quotation_id, title, variant_label, unit, quantity, unit_price, line_total",
          )
          .in("quotation_id", quoteIds)
      : { data: [] };
  const quotationItems = (quotationItemRows ?? []) as unknown as QuotationItemRow[];

  const supplierName =
    (contact as { supplier_name?: string } | null)?.supplier_name ?? null;
  const supplierPhone = (contact as { phone?: string } | null)?.phone ?? null;
  const waLink = supplierName
    ? whatsappContactLink(supplierPhone, contactMessage(supplierName, orderRow.reference))
    : null;

  const latestSentId =
    quoteRows.filter((quote) => quote.status === "sent").at(-1)?.id ?? null;
  const acceptedQuote =
    quoteRows.filter((quote) => quote.status === "accepted").at(-1) ?? null;

  const hasShipment = Boolean(
    orderRow.carrier || orderRow.tracking_ref || orderRow.shipment_notes || orderRow.shipped_at,
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5">
      {/* Header ----------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/orders" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            My Orders
          </Button>
          <h1 className="font-mono text-lg font-bold tracking-tight md:text-xl">
            {orderRow.reference}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE[status] ?? "outline"}>
            {ORDER_STATUS_LABELS[status]}
          </Badge>
          <Badge variant="outline">
            Payment:{" "}
            {PAYMENT_STATUS_LABELS[
              parsePaymentStatus(orderRow.payment_status) ?? "not_requested"
            ]}
          </Badge>
        </div>
      </div>

      {status === "cancelled" && orderRow.rejection_reason ? (
        <Card className="rounded-lg border-destructive/40 p-4">
          <p className="text-sm font-medium">Cancelled by the supplier</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {orderRow.rejection_reason}
          </p>
        </Card>
      ) : null}

      {/* Supplier contact ------------------------------------------------------- */}
      <Card className="rounded-lg p-4">
        <CardHeader className="p-0">
          <CardTitle className="text-base">Supplier</CardTitle>
          <CardDescription>
            {supplierName ?? "The supplier you ordered from"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {waLink ? (
            <Button
              render={<a href={waLink} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
              variant="outline"
              size="sm"
              className="mt-3"
            >
              <HugeiconsIcon icon={CallIcon} strokeWidth={2} />
              Message on WhatsApp
            </Button>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              The supplier has not published a WhatsApp number, so there is no
              chat link here. Use their store page or the order notes to stay
              in touch — this platform never shares contact details beyond
              this page.
            </p>
          )}
          {waLink ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Opens WhatsApp with a short message containing only your order
              reference — no address or prices are shared.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Items + amounts -------------------------------------------------------- */}
      <Card className="!gap-0 !pb-0">
        <CardHeader className="border-b border-border">
          <CardTitle>Items</CardTitle>
          <CardDescription>
            Prices as placed — they never change on this order.
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Unit</TableHead>
                <TableHead className="text-right tabular-nums">Qty</TableHead>
                <TableHead className="text-right tabular-nums">Unit price</TableHead>
                <TableHead className="text-right tabular-nums">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.variant_label ? (
                      <p className="text-xs text-muted-foreground">{item.variant_label}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {item.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupees(Number(item.unit_price))}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatRupees(Number(item.unit_price) * item.quantity)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Amounts ------------------------------------------------------------- */}
        <Card className="h-fit rounded-lg p-4">
          <p className="text-sm font-semibold">Amounts</p>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Items subtotal</span>
              <span className="tabular-nums">{formatRupees(Number(orderRow.subtotal))}</span>
            </div>
            {Number(orderRow.discount) > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">
                  − {formatRupees(Number(orderRow.discount))}
                </span>
              </div>
            ) : null}
            {acceptedQuote ? (
              <>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-medium">
                    Agreed total (quotation v{acceptedQuote.version})
                  </span>
                  <span className="font-bold tabular-nums">
                    {formatRupees(Number(acceptedQuote.total))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Pay the supplier directly using their shared details — this
                  platform does not collect money. The supplier marks payment
                  received here once it lands.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">Total</span>
                <span className="font-bold tabular-nums">
                  {formatRupees(Number(orderRow.subtotal) - Number(orderRow.discount))}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Delivery address ----------------------------------------------------- */}
        <Card className="h-fit rounded-lg p-4">
          <p className="text-sm font-semibold">Delivery address</p>
          {delivery ? (
            <div className="mt-2 text-sm">
              <p className="font-medium">{delivery.fullName}</p>
              <p className="mt-1 text-muted-foreground">{delivery.line1}</p>
              {delivery.line2 ? (
                <p className="text-muted-foreground">{delivery.line2}</p>
              ) : null}
              <p className="text-muted-foreground">
                {[delivery.city, delivery.state, delivery.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="mt-1 text-muted-foreground">Phone: {delivery.phone}</p>
              {delivery.instructions ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Instructions: {delivery.instructions}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No address snapshot stored.
            </p>
          )}
          {orderRow.buyer_note ? (
            <p className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">
              Your note: {orderRow.buyer_note}
            </p>
          ) : null}
        </Card>
      </div>

      {/* Shipment --------------------------------------------------------------- */}
      {hasShipment ? (
        <Card className="rounded-lg p-4">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={TruckDeliveryIcon} strokeWidth={2} className="size-4" />
            <p className="text-sm font-semibold">Shipment</p>
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            {orderRow.shipped_at ? (
              <p>Shipped on {formatDateTime(orderRow.shipped_at)}</p>
            ) : null}
            {orderRow.carrier ? <p>Carrier: {orderRow.carrier}</p> : null}
            {orderRow.tracking_ref ? (
              <p>Tracking reference: {orderRow.tracking_ref}</p>
            ) : null}
            {orderRow.shipment_notes ? <p>{orderRow.shipment_notes}</p> : null}
          </div>
        </Card>
      ) : null}

      {/* Quotations ------------------------------------------------------------- */}
      <Card className="!gap-0 !pb-0">
        <CardHeader className="border-b border-border">
          <CardTitle>Quotations</CardTitle>
          <CardDescription>
            The supplier may revise prices here when the real deal differs from
            the cart. Accept a version to agree the final amounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 !px-0">
          {quoteRows.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No quotations yet — the supplier confirms or quotes your order
              from their dashboard.
            </p>
          ) : null}

          {quoteRows
            .filter((quote) => quote.id === latestSentId)
            .map((quote) => {
              const quoteItems = quotationItems.filter(
                (item) => item.quotation_id === quote.id,
              );
              const expired = isExpired(quote.expires_at);
              const badge = expired ? QUOTE_BADGE.expired : QUOTE_BADGE.pending;
              return (
                <div key={quote.id} className="flex flex-col gap-3 px-4 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      Quotation v{quote.version}
                      <span className="ml-2 font-normal text-muted-foreground">
                        sent {formatDate(quote.created_at)}
                      </span>
                    </p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {quoteItems.map((item) => (
                      <li
                        key={`${quote.id}-${item.title}-${item.quantity}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 truncate">
                          {item.title}
                          {item.variant_label ? ` · ${item.variant_label}` : ""}{" "}
                          <span className="text-muted-foreground tabular-nums">
                            × {item.quantity} {item.unit} @ {formatRupees(Number(item.unit_price))}
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {formatRupees(Number(item.line_total))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-1 border-t border-border pt-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Items subtotal</span>
                      <span className="tabular-nums">{formatRupees(Number(quote.subtotal))}</span>
                    </div>
                    {Number(quote.delivery_charge) > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="tabular-nums">
                          {formatRupees(Number(quote.delivery_charge))}
                        </span>
                      </div>
                    ) : null}
                    {Number(quote.tax_amount) > 0 ? (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tax</span>
                        <span className="tabular-nums">
                          {formatRupees(Number(quote.tax_amount))}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold tabular-nums">
                        {formatRupees(Number(quote.total))}
                      </span>
                    </div>
                  </div>
                  {quote.note ? (
                    <p className="text-sm text-muted-foreground">Note: {quote.note}</p>
                  ) : null}
                  {quote.expires_at ? (
                    <p className="text-xs text-muted-foreground">
                      Valid until {formatDate(quote.expires_at)}
                      {expired ? " — expired; ask for a revised quote" : ""}
                    </p>
                  ) : null}
                  {status !== "cancelled" && status !== "delivered" ? (
                    expired ? (
                      <p className="text-sm text-muted-foreground">
                        This quotation has expired and can no longer be
                        accepted.
                      </p>
                    ) : (
                      <QuoteResponseButtons
                        orderId={orderRow.id}
                        quotationId={quote.id}
                        totalLabel={formatRupees(Number(quote.total))}
                      />
                    )
                  ) : null}
                </div>
              );
            })}

          {quoteRows.filter((quote) => quote.id !== latestSentId).length > 0 ? (
            <div className="px-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Earlier versions
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {quoteRows
                  .filter((quote) => quote.id !== latestSentId)
                  .reverse()
                  .map((quote) => (
                    <li
                      key={quote.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-muted-foreground">
                        v{quote.version} ·{" "}
                        {quote.status === "accepted"
                          ? `accepted ${formatDate(quote.accepted_at ?? quote.created_at)}`
                          : QUOTATION_STATUS_LABELS[quote.status] ?? quote.status}
                      </span>
                      <span className="tabular-nums">
                        {formatRupees(Number(quote.total))}
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

      {/* History ---------------------------------------------------------------- */}
      <Card className="!gap-0 !pb-0">
        <CardHeader className="border-b border-border">
          <CardTitle>Order history</CardTitle>
          <CardDescription>
            Every step of this order, as recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          <ul className="divide-y divide-border">
            {((events ?? []) as { id: string; event: string; data: Record<string, unknown>; created_at: string }[]).map(
              (event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="text-sm">{eventLabel(event)}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(event.created_at)}
                  </span>
                </li>
              ),
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
