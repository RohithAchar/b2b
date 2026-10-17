"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { placeOrder, type CheckoutActionState } from "@/lib/buyer/checkout-actions";
import type { CheckoutPreview } from "@/lib/buyer/checkout-queries";
import type { BuyerAddress } from "@/lib/orders/delivery";
import { formatDeliveryLine } from "@/lib/orders/delivery";
import { formatRupees } from "@/lib/format";

const initialState: CheckoutActionState = { ok: false, message: "", orderIds: [] };

export function CheckoutClient({
  preview,
  addresses,
}: {
  preview: CheckoutPreview;
  addresses: BuyerAddress[];
}) {
  const router = useRouter();
  // One request id per checkout attempt: retries after a timeout or double
  // click reuse it, so the server never creates duplicate orders.
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(placeOrder, initialState);

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? "");

  useEffect(() => {
    if (state.ok && state.orderIds.length > 0) {
      router.push(`/checkout/success?orders=${state.orderIds.join(",")}`);
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Supplier grouping ------------------------------------------------ */}
        {preview.groups.map((group) => (
          <Card key={group.supplierId} className="rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{group.supplierName}</p>
              <Badge variant="secondary">{group.lines.length} item{group.lines.length === 1 ? "" : "s"}</Badge>
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {group.lines.map((line) => (
                <li
                  key={line.cartItemId}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{line.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} {line.unit} × {formatRupees(line.unitPrice)}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums">
                    {formatRupees(line.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Store subtotal</span>
                <span className="tabular-nums">{formatRupees(group.subtotal)}</span>
              </div>
              {group.coupon ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Coupon {group.coupon.code}
                  </span>
                  <span className="font-bold text-success tabular-nums">
                    −{formatRupees(group.coupon.discount)}
                  </span>
                </div>
              ) : null}
              {group.couponError ? (
                <p className="text-xs text-warning">{group.couponError}</p>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="font-semibold">Store total</span>
                <span className="font-bold tabular-nums">{formatRupees(group.total)}</span>
              </div>
            </div>
          </Card>
        ))}

        {/* Delivery address -------------------------------------------------- */}
        <Card className="rounded-lg p-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Delivery address</CardTitle>
            <CardDescription>
              One address per order. Suppliers see this address only for orders
              you place with them.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {addresses.length === 0 ? (
              <Alert>
                <AlertDescription>
                  You have no saved addresses yet.{" "}
                  <Link href="/account?tab=addresses" className="font-medium underline">
                    Add a delivery address
                  </Link>{" "}
                  to place your order.
                </AlertDescription>
              </Alert>
            ) : (
              <RadioGroup
                className="mt-3 flex flex-col gap-2"
                value={addressId}
                onValueChange={setAddressId}
              >
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <RadioGroupItem value={address.id} className="mt-0.5" />
                    <div className="min-w-0 text-sm">
                      <span className="font-medium">{address.fullName}</span>{" "}
                      <span className="text-muted-foreground">{address.phone}</span>
                      {address.isDefault ? (
                        <Badge className="ml-2">Default</Badge>
                      ) : null}
                      <p className="text-muted-foreground">
                        {formatDeliveryLine(address)}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Need a different address?{" "}
              <Link href="/account?tab=addresses" className="underline">
                Manage addresses
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary + place order ---------------------------------------------- */}
      <div className="w-full lg:w-80 lg:shrink-0">
        <Card className="h-fit rounded-lg p-4 lg:sticky lg:top-32">
          <p className="text-sm font-semibold">Order summary</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatRupees(preview.subtotal)}</span>
          </div>
          {preview.savings > 0 ? (
            <div className="mt-1.5 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Coupon savings</span>
              <span className="font-bold text-success tabular-nums">
                −{formatRupees(preview.savings)}
              </span>
            </div>
          ) : null}
          <div className="mt-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold">Estimated total</span>
            <span className="font-bold tabular-nums">{formatRupees(preview.total)}</span>
          </div>

          <form action={action} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="addressId" value={addressId} />

            <Field>
              <FieldLabel htmlFor="buyerNote">
                Note for suppliers (optional)
              </FieldLabel>
              <Textarea
                id="buyerNote"
                name="buyerNote"
                rows={2}
                placeholder="Delivery timing, packaging, invoice needs…"
              />
            </Field>

            {!state.ok && state.message ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending || addresses.length === 0 || !preview.meetsMinimum}
            >
              {pending ? "Placing order…" : "Place order"}
            </Button>
          </form>

          <p className="mt-3 text-xs text-muted-foreground">
            No online payment. After suppliers review your order, you pay them
            directly and they confirm receipt here.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {preview.meetsMinimum
              ? "Amounts shown are estimates; suppliers confirm final charges (and any delivery or tax) with a quotation."
              : `Add ${formatRupees(preview.shortfall)} more to reach the ${formatRupees(2500)} minimum.`}
          </p>
          {preview.unavailableCount > 0 ? (
            <p className="mt-2 text-xs text-warning">
              {preview.unavailableCount} cart item
              {preview.unavailableCount === 1 ? " is" : "s are"} no longer
              available and won&apos;t be ordered.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
