"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  respondToQuotation,
  type QuoteResponseState,
} from "@/lib/buyer/quotation-actions";

const initialState: QuoteResponseState = { ok: false, message: "" };

/**
 * Buyer response to the latest pending quotation. Acceptance approves the
 * quoted deal only — payment is arranged directly with the supplier and is
 * confirmed by them; nothing here marks an order paid.
 */
export function QuoteResponseButtons({
  orderId,
  quotationId,
  totalLabel,
}: {
  orderId: string;
  quotationId: string;
  totalLabel: string;
}) {
  const [state, action, pending] = useActionState(
    respondToQuotation,
    initialState,
  );

  if (state.ok && state.message) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }

  function form(accept: "yes" | "no"): FormData {
    const formData = new FormData();
    formData.set("quotationId", quotationId);
    formData.set("orderId", orderId);
    formData.set("accept", accept);
    return formData;
  }

  return (
    <div className="flex flex-col gap-3">
      {!state.ok && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          trigger={
            <Button disabled={pending}>Accept quotation · {totalLabel}</Button>
          }
          title="Accept this quotation?"
          description="This locks in the quoted prices, delivery and tax as agreed with the supplier. Pay them directly afterwards — this platform does not collect money."
          confirmLabel="Accept quotation"
          variant="default"
          onConfirm={() => action(form("yes"))}
        />
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={pending}>
              Reject quotation
            </Button>
          }
          title="Reject this quotation?"
          description="The supplier will see that you declined this version and can send a revised one. Your order stays exactly as placed."
          confirmLabel="Reject quotation"
          variant="destructive"
          onConfirm={() => action(form("no"))}
        />
      </div>
    </div>
  );
}
