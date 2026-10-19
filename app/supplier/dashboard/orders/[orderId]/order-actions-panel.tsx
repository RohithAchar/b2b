"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckIcon,
  Tick01Icon,
  TruckDeliveryIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "cn";
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
  orderAtOrBeyond,
  parseOrderStatus,
  parsePaymentStatus,
  type SupplierOrderAction,
} from "@/lib/orders/lifecycle";

const initialResult: OrderActionResult = { ok: false, message: "" };

/**
 * One linear flow for the supplier: review the order, settle payment, process,
 * ship, deliver — in that order, each step holding its own actions instead of
 * scattering them across the page. Steps follow the same lifecycle rules the
 * database guard enforces, so nothing here can offer an illegal transition.
 *
 * Completed steps collapse to a tick, the current step expands with its
 * buttons, later steps stay muted but reachable (the server rejects any
 * out-of-sequence attempt regardless).
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
  const payment = parsePaymentStatus(paymentStatus) ?? "not_requested";
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

  if (!orderStatus || orderStatus === "cancelled") {
    return null;
  }

  const reviewDone = orderStatus !== "new" && orderStatus !== "quoted";
  const processDone = orderAtOrBeyond(orderStatus, "processing");
  const shipDone = orderAtOrBeyond(orderStatus, "shipped");
  const deliverDone = orderStatus === "delivered";
  // Once the order is delivered nothing further can change on the payment
  // track, so the step counts as closed even if money was never confirmed.
  const paymentDone = payment === "paid" || deliverDone;

  const steps: StepDef[] = [
    {
      key: "review",
      title: "Review the order",
      description: reviewDone
        ? "The order has moved on from review."
        : orderStatus === "quoted"
          ? "Your quotation is with the buyer — you can also accept or reject now."
          : "Check the items, then quote a price or confirm the order as placed.",
      done: reviewDone,
      body: reviewDone ? null : (
        <>
          {actions.includes("create_quotation") ? (
            <Button
              render={
                <Link href={`/supplier/dashboard/orders/${orderId}/quote`} />
              }
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              Send quotation
            </Button>
          ) : null}
          {actions.includes("accept") ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" disabled={pending}>
                  <HugeiconsIcon
                    icon={CheckIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
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
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setRejectOpen(true)}
            >
              Reject order
            </Button>
          ) : null}
        </>
      ),
    },
    {
      key: "payment",
      title: "Confirm payment",
      description: paymentDone
        ? "Payment is settled for this order."
        : payment === "claimed"
          ? "The buyer submitted a reference — check your bank or UPI, then confirm or report it."
          : payment === "pending"
            ? "Payment requested. Waiting for the buyer to submit their reference."
            : "Ask for payment, or mark it received once the money lands in your account.",
      done: paymentDone,
      body: paymentDone ? null : (
        <>
          {actions.includes("mark_payment_pending") &&
          payment !== "pending" &&
          payment !== "claimed" ? (
            <Button
              variant="outline"
              size="sm"
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
                <Button
                  size="sm"
                  variant={payment === "claimed" ? "default" : "outline"}
                  disabled={pending}
                >
                  {payment === "claimed"
                    ? "Confirm payment received"
                    : "Mark payment received"}
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
          {actions.includes("mark_payment_not_received") && payment === "claimed" ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" disabled={pending}>
                  Payment not received
                </Button>
              }
              title="Mark payment as not received?"
              description="Use this only after checking your bank/UPI and finding no matching payment. The buyer will be asked to check the reference and submit it again."
              confirmLabel="Yes, not received"
              variant="destructive"
              onConfirm={() =>
                run(() => setOrderPaymentStatus(initialResult, paymentToForm(orderId, "pending")))
              }
            />
          ) : null}
        </>
      ),
    },
    {
      key: "processing",
      title: "Process the order",
      description: processDone
        ? "Processing has started."
        : "Start picking and packing the items once the order is confirmed.",
      done: processDone,
      body: processDone ? null : (
        <>
          {actions.includes("start_processing") ? (
            <Button
              size="sm"
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
        </>
      ),
    },
    {
      key: "shipment",
      title: "Record shipment",
      description: shipDone
        ? "Shipment details are on the order."
        : "Add the carrier and tracking reference so the buyer can follow it.",
      done: shipDone,
      body: shipDone ? null : (
        <>
          {actions.includes("record_shipment") ? (
            <Button size="sm" disabled={pending} onClick={() => setShipOpen(true)}>
              <HugeiconsIcon
                icon={TruckDeliveryIcon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Record shipment
            </Button>
          ) : null}
        </>
      ),
    },
    {
      key: "delivered",
      title: "Mark delivered",
      description: deliverDone
        ? "The buyer has received this order."
        : "Confirm only once the shipment has reached the buyer.",
      done: deliverDone,
      body: deliverDone ? null : (
        <>
          {actions.includes("mark_delivered") ? (
            <ConfirmDialog
              trigger={
                <Button size="sm" disabled={pending}>
                  <HugeiconsIcon
                    icon={CheckIcon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
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
        </>
      ),
    },
  ];

  const currentIndex = steps.findIndex((step) => !step.done);

  return (
    <div className="flex flex-col gap-3">
      {notice && notice.message ? (
        <Alert variant={notice.ok ? "default" : "destructive"}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
          <h2 className="text-sm font-semibold">
            {currentIndex === -1 ? "Order flow complete" : "What to do next"}
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {currentIndex === -1
              ? `${steps.length} of ${steps.length} steps done`
              : `Step ${currentIndex + 1} of ${steps.length} · ${steps[currentIndex].title}`}
          </p>
        </header>

        <ol className="divide-y divide-border">
          {steps.map((step, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li
                key={step.key}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "flex gap-3 px-4 py-3",
                  isCurrent && "bg-primary/[0.04]",
                )}
              >
                <span className="pt-0.5">
                  <StepMarker done={step.done} current={isCurrent} index={index} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        step.done
                          ? "text-muted-foreground"
                          : isCurrent
                            ? "text-foreground"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    {isCurrent ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                        Now
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                  {step.body ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {step.body}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

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

type StepDef = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  body: React.ReactNode;
};

function StepMarker({
  done,
  current,
  index,
}: {
  done: boolean;
  current: boolean;
  index: number;
}) {
  if (done) {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-success text-white [&_svg]:size-3.5">
        <HugeiconsIcon icon={Tick01Icon} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-5 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums",
        current
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
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
