"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { claimPayment, type PaymentClaimState } from "@/lib/buyer/payment-actions";

const initialState: PaymentClaimState = { ok: false, message: "" };

/**
 * Records the buyer's claim only. It never marks the order paid — the supplier
 * verifies the reference and confirms receipt separately.
 */
export function PaymentClaimForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(claimPayment, initialState);

  if (state.ok) {
    return (
      <Alert>
        <AlertDescription>
          <p className="font-medium">Payment submitted</p>
          <p className="mt-1">
            Reference <span className="font-mono">{state.reference}</span> is recorded
            and the supplier has been alerted. The order stays unpaid until they
            verify and confirm receipt.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="orderId" value={orderId} />
      {!state.ok && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reference">UPI / UTR reference</FieldLabel>
          <Input
            id="reference"
            name="reference"
            required
            minLength={6}
            maxLength={30}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 412345678901"
            className="font-mono uppercase"
          />
          <FieldDescription>
            Copy it from your UPI app&apos;s payment details. Letters, digits and
            dashes only.
          </FieldDescription>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "I have paid — submit reference"}
        </Button>
      </FieldGroup>
    </form>
  );
}
