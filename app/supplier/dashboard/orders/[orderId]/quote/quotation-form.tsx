"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  sendQuotation,
  type QuotationActionState,
} from "@/lib/supplier/quotation-actions";
import {
  computeQuotationTotals,
  roundRupees,
} from "@/lib/orders/quotation";
import { formatRupees } from "@/lib/format";

const initialState: QuotationActionState = { ok: false, message: "" };

type Line = {
  orderItemId: string;
  title: string;
  variantLabel: string | null;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export function QuotationForm({
  orderId,
  items,
}: {
  orderId: string;
  items: {
    orderItemId: string;
    title: string;
    variantLabel: string | null;
    unit: string;
    quantity: number;
    unitPrice: number;
  }[];
}) {
  const [state, action, pending] = useActionState(sendQuotation, initialState);
  const [lines, setLines] = useState<Line[]>(() =>
    items.map((item) => ({
      orderItemId: item.orderItemId,
      title: item.title,
      variantLabel: item.variantLabel,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  );
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");

  const parsedLines = lines.map((line) => ({
    orderItemId: line.orderItemId,
    quantity: Number(line.quantity),
    unitPrice: Number(line.unitPrice),
  }));
  const validLines = parsedLines.filter(
    (line) =>
      Number.isInteger(line.quantity) &&
      line.quantity >= 1 &&
      Number.isFinite(line.unitPrice) &&
      line.unitPrice >= 0,
  );
  const totals = computeQuotationTotals(
    validLines,
    Math.max(0, Number(deliveryCharge) || 0),
    Math.max(0, Number(taxAmount) || 0),
  );
  const allLinesValid = validLines.length === lines.length;

  function updateLine(orderItemId: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line) => (line.orderItemId === orderItemId ? { ...line, ...patch } : line)),
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />

      <Card className="!gap-0 !pb-0 rounded-lg">
        <CardHeader className="border-b border-border">
          <CardTitle>Priced lines</CardTitle>
          <CardDescription>
            Pre-filled with the ordered quantities and prices — adjust to the
            deal you are confirming.
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          <div className="flex flex-col">
            {lines.map((line) => (
              <div
                key={line.orderItemId}
                className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-end"
              >
                <input
                  type="hidden"
                  name="orderItemId"
                  value={line.orderItemId}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.variantLabel ? `${line.variantLabel} · ` : ""}
                    Ordered: {line.quantity} {line.unit}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:w-64">
                  <Field>
                    <FieldLabel htmlFor={`qty-${line.orderItemId}`}>
                      Quantity
                    </FieldLabel>
                    <Input
                      id={`qty-${line.orderItemId}`}
                      name="quantity"
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.orderItemId, { quantity: e.target.value })}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`price-${line.orderItemId}`}>
                      Unit price (₹)
                    </FieldLabel>
                    <Input
                      id={`price-${line.orderItemId}`}
                      name="unitPrice"
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.orderItemId, { unitPrice: e.target.value })}
                      required
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-lg p-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Charges</CardTitle>
            <CardDescription>
              Add only what you will actually bill. Leave at 0 if none.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <FieldGroup className="mt-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="deliveryCharge">
                    Delivery charge (₹)
                  </FieldLabel>
                  <Input
                    id="deliveryCharge"
                    name="deliveryCharge"
                    inputMode="decimal"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="taxAmount">Tax amount (₹)</FieldLabel>
                  <Input
                    id="taxAmount"
                    name="taxAmount"
                    inputMode="decimal"
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(e.target.value)}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="note">Note to the buyer</FieldLabel>
                <Textarea
                  id="note"
                  name="note"
                  rows={2}
                  placeholder="What changed vs the order, packing, lead time…"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expiresOn">
                  Valid until (optional)
                </FieldLabel>
                <Input id="expiresOn" name="expiresOn" type="date" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="h-fit rounded-lg p-4">
          <p className="text-sm font-semibold">Quotation total</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Items subtotal</span>
            <span className="tabular-nums">{formatRupees(totals.subtotal)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span className="tabular-nums">
              {formatRupees(roundRupees(Math.max(0, Number(deliveryCharge) || 0)))}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">
              {formatRupees(roundRupees(Math.max(0, Number(taxAmount) || 0)))}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="font-semibold">Total</span>
            <span className="font-bold tabular-nums">{formatRupees(totals.total)}</span>
          </div>

          {!state.ok && state.message ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.ok ? (
            <Alert className="mt-3">
              <AlertDescription>
                {state.message}{" "}
                <Link
                  href={`/supplier/dashboard/orders/${orderId}`}
                  className="font-medium underline"
                >
                  Back to the order
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-4 w-full"
            disabled={pending || !allLinesValid}
          >
            {pending ? "Sending…" : "Send quotation"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            The original order stays exactly as placed. The buyer must accept
            this version before payment is due — nothing is marked paid here.
          </p>
        </Card>
      </div>
    </form>
  );
}
