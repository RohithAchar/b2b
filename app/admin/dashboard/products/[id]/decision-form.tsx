"use client";

import { useActionState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { approveProduct, rejectProduct } from "@/lib/admin/products";
import type { AdminActionState } from "@/lib/admin/actions";

const initial: AdminActionState = { ok: false, message: "" };

export function ProductDecisionForm({ productId }: { productId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approveProduct, initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectProduct, initial);
  const message = rejectState.message || approveState.message;

  return (
    <form action={approveAction}>
      <FieldGroup>
        <input type="hidden" name="id" value={productId} />
        <Field>
          <FieldLabel htmlFor="note">
            Note for supplier (required to send back)
          </FieldLabel>
          <Textarea
            id="note"
            name="note"
            placeholder="What should the supplier fix?"
          />
        </Field>
        {message ? (
          <Alert variant={approveState.ok ? "default" : "destructive"}>
            <AlertTitle>{approveState.ok ? "Done" : "Check the form"}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <ButtonGroup>
          <Button type="submit" disabled={approvePending}>
            {approvePending ? "Approving…" : "Approve"}
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={rejectPending}
            formAction={rejectAction}
          >
            {rejectPending ? "Sending…" : "Send back"}
          </Button>
        </ButtonGroup>
      </FieldGroup>
    </form>
  );
}
