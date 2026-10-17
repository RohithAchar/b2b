"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckIcon, TruckDeliveryIcon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  acceptOrder,
  advanceOrderStatus,
  recordShipment,
  rejectOrder,
  setOrderPaymentStatus,
  type OrderActionResult,
} from "@/lib/supplier/order-actions";
import {
  availableSupplierActions,
  parseOrderStatus,
  type SupplierOrderAction,
} from "@/lib/orders/lifecycle";

const initialResult: OrderActionResult = { ok: false, message: "" };

/**
 * Explicit action buttons for the order's current state — never a generic
 * status dropdown. Every mutation runs server-side checks first.
 */
export function OrderActionsPanel({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string;
  status: string;
  paymentStatus: string;
}) {
  const orderStatus = parseOrderStatus(status);
  const actions: readonly SupplierOrderAction[] = orderStatus
    ? availableSupplierActions(orderStatus)
    : [];

  const [notice, setNotice] = useState<OrderActionResult | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<OrderActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      setNotice(result);
    });
  }

  /** Run a (prev, formData) action inside the transition, closing on success. */
  function runForm(
    action: (prev: OrderActionResult, formData: FormData) => Promise<OrderActionResult>,
    formData: FormData,
    onOk?: () => void,
  ) {
    setNotice(null);
    startTransition(async () => {
      const result = await action(initialResult, formData);
      setNotice(result);
      if (result.ok) onOk?.();
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {notice && notice.message ? (
        <Alert variant={notice.ok ? "default" : "destructive"}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.includes("accept") ? (
          <ConfirmDialog
            trigger={
              <Button disabled={pending}>
                <HugeiconsIcon icon={CheckIcon} strokeWidth={2} data-icon="inline-start" />
                Accept order
              </Button>
            }
            title="Confirm this order?"
            description="You confirm availability, the listed price and delivery feasibility. The buyer sees it as confirmed."
            confirmLabel="Confirm order"
            variant="default"
            onConfirm={() => run(() => acceptOrder(orderId))}
          />
        ) : null}

        {actions.includes("reject") ? (
          <Button variant="outline" disabled={pending} onClick={() => setRejectOpen(true)}>
            Reject order
          </Button>
        ) : null}

        {actions.includes("start_processing") ? (
          <Button
            disabled={pending}
            onClick={() =>
              run(() =>
                advanceOrderStatus(initialResult, orderIdToForm(orderId, "processing")),
              )
            }
          >
            Start processing
          </Button>
        ) : null}

        {actions.includes("record_shipment") ? (
          <Button disabled={pending} onClick={() => setShipOpen(true)}>
            <HugeiconsIcon icon={TruckDeliveryIcon} strokeWidth={2} data-icon="inline-start" />
            Record shipment
          </Button>
        ) : null}

        {actions.includes("mark_delivered") ? (
          <ConfirmDialog
            trigger={
              <Button disabled={pending}>
                <HugeiconsIcon icon={CheckIcon} strokeWidth={2} data-icon="inline-start" />
                Mark delivered
              </Button>
            }
            title="Mark this order as delivered?"
            description="Only do this once the shipment has reached the buyer."
            confirmLabel="Mark delivered"
            variant="default"
            onConfirm={() =>
              run(() => advanceOrderStatus(initialResult, orderIdToForm(orderId, "delivered")))
            }
          />
        ) : null}

        {actions.includes("mark_payment_pending") && paymentStatus !== "pending" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() =>
                setOrderPaymentStatus(initialResult, paymentToForm(orderId, "pending")),
              )
            }
          >
            Awaiting payment
          </Button>
        ) : null}

        {actions.includes("mark_paid") ? (
          <ConfirmDialog
            trigger={
              <Button variant="outline" disabled={pending}>
                Mark payment received
              </Button>
            }
            title="Confirm payment received?"
            description="Only confirm after you have verified the money in your own bank, UPI or agreed channel. This record shows you confirmed it — the platform does not verify payments."
            confirmLabel="Yes, I received payment"
            variant="default"
            onConfirm={() =>
              run(() => setOrderPaymentStatus(initialResult, paymentToForm(orderId, "paid")))
            }
          />
        ) : null}
      </div>

      {/* Reject dialog ------------------------------------------------------------ */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this order?</DialogTitle>
            <DialogDescription>
              Tell the buyer why. They will see this reason on the order.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) =>
              runForm(rejectOrder, formData, () => setRejectOpen(false))
            }
          >
            <FieldGroup>
              {!notice?.ok && notice?.message && rejectOpen ? (
                <Alert variant="destructive">
                  <AlertDescription>{notice.message}</AlertDescription>
                </Alert>
              ) : null}
              <input type="hidden" name="orderId" value={orderId} />
              <Field>
                <FieldLabel htmlFor="reason">Reason</FieldLabel>
                <Textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  placeholder="e.g. Out of stock for two weeks; unable to meet the quantity."
                  required
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? "Rejecting…" : "Reject order"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Shipment dialog ----------------------------------------------------------- */}
      <Dialog open={shipOpen} onOpenChange={setShipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record shipment</DialogTitle>
            <DialogDescription>
              The buyer sees these details on their order. All fields are optional.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) =>
              runForm(recordShipment, formData, () => setShipOpen(false))
            }
          >
            <FieldGroup>
              {!notice?.ok && notice?.message && shipOpen ? (
                <Alert variant="destructive">
                  <AlertDescription>{notice.message}</AlertDescription>
                </Alert>
              ) : null}
              <input type="hidden" name="orderId" value={orderId} />
              <Field>
                <FieldLabel htmlFor="carrier">Carrier / delivery provider</FieldLabel>
                <Input id="carrier" name="carrier" placeholder="e.g. Delhivery, own fleet" />
              </Field>
              <Field>
                <FieldLabel htmlFor="trackingRef">Tracking reference</FieldLabel>
                <Input id="trackingRef" name="trackingRef" placeholder="AWB / tracking number" />
              </Field>
              <Field>
                <FieldLabel htmlFor="shipmentNotes">Delivery notes</FieldLabel>
                <Textarea
                  id="shipmentNotes"
                  name="shipmentNotes"
                  rows={2}
                  placeholder="Packing, dispatch date, handling notes…"
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShipOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Mark as shipped"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Build the FormData shape the (prev, formData) actions expect. */
function orderIdToForm(orderId: string, value: string): FormData {
  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("to", value);
  return formData;
}

/** Same helper for payment updates (uses `paymentStatus`, not `to`). */
export function paymentToForm(orderId: string, paymentStatus: string): FormData {
  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("paymentStatus", paymentStatus);
  return formData;
}
