import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import type { OrderStatus, PaymentStatus } from "@/lib/orders/lifecycle";

// Shared buyer/supplier order tracker. One visual language across both sides.
// Steps are marked from the real status + payment-status model; nothing is
// inferred beyond what the database actually recorded.

const STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "quoted", label: "Quotation sent" },
  { key: "submitted", label: "Payment submitted" },
  { key: "paid", label: "Payment confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
] as const;

type StepState = "done" | "current" | "future";

function stepStates(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  hasQuotation: boolean,
  quotationAccepted: boolean,
): StepState[] {
  const quotedDone = quotationAccepted || (status !== "quoted" && (hasQuotation || status !== "new"));
  const done = [
    true,
    quotedDone,
    paymentStatus === "claimed" || paymentStatus === "paid",
    paymentStatus === "paid",
    status === "processing" || status === "shipped" || status === "delivered",
    status === "shipped" || status === "delivered",
    status === "delivered",
  ];
  const firstIncomplete = done.indexOf(false);
  const current = firstIncomplete === -1 ? done.length - 1 : firstIncomplete;
  return done.map((isDone, index) =>
    isDone ? "done" : index === current ? "current" : "future",
  );
}

function StepCircle({ state, index }: { state: StepState; index: number }) {
  if (state === "done") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-success bg-success text-white">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          strokeWidth={2}
          className="size-4"
        />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums",
        state === "current"
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  );
}

export function OrderProgress({
  status,
  paymentStatus,
  hasQuotation = false,
  quotationAccepted = false,
  cancelledReason,
}: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  hasQuotation?: boolean;
  quotationAccepted?: boolean;
  cancelledReason?: string | null;
}) {
  if (status === "cancelled") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 text-xs font-bold text-destructive">
          ✕
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-destructive">Order cancelled</p>
          {cancelledReason ? (
            <p className="text-xs text-muted-foreground">{cancelledReason}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const states = stepStates(status, paymentStatus, hasQuotation, quotationAccepted);

  return (
    <div aria-label="Order progress">
      {/* Desktop: horizontal */}
      <ol className="hidden md:flex">
        {STEPS.map((step, index) => (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === 0
                    ? "bg-transparent"
                    : states[Math.max(0, index - 1)] === "done"
                      ? "bg-success"
                      : "bg-border",
                )}
              />
              <StepCircle state={states[index]} index={index} />
              <span
                className={cn(
                  "h-0.5 flex-1",
                  index === STEPS.length - 1
                    ? "bg-transparent"
                    : states[index] === "done"
                      ? "bg-success"
                      : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "mt-2 px-1 text-center text-[11px] leading-tight",
                states[index] === "current"
                  ? "font-semibold text-primary"
                  : states[index] === "done"
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {/* Mobile: vertical */}
      <ol className="flex flex-col md:hidden">
        {STEPS.map((step, index) => {
          const isLast = index === STEPS.length - 1;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepCircle state={states[index]} index={index} />
                {!isLast ? (
                  <span
                    className={cn(
                      "w-0.5 flex-1",
                      states[index] === "done" ? "bg-success" : "bg-border",
                    )}
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "pt-0.5 text-sm",
                  isLast ? "" : "pb-4",
                  states[index] === "current"
                    ? "font-semibold text-primary"
                    : states[index] === "done"
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
