"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  approveCompany,
  rejectCompany,
  type AdminActionState,
} from "@/lib/admin/actions";

const initialState: AdminActionState = { ok: false, message: "" };

export function DecisionForm({ id }: { id: string }) {
  const [approveState, approveAction, approving] = useActionState(
    approveCompany,
    initialState,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectCompany,
    initialState,
  );
  const [showReject, setShowReject] = useState(false);
  const message = approveState.message || rejectState.message;

  return (
    <FieldGroup>
      {message ? (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      <form action={approveAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" disabled={approving || rejecting}>
          {approving ? "Approving…" : "Approve supplier"}
        </Button>
      </form>
      {!showReject ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowReject(true)}
        >
          Send back with note
        </Button>
      ) : (
        <form action={rejectAction}>
          <FieldGroup>
            <input type="hidden" name="id" value={id} />
            <Field>
              <FieldLabel htmlFor="note">
                What should the supplier fix?
              </FieldLabel>
              <Textarea
                id="note"
                name="note"
                placeholder="e.g. GST certificate is blurry — please upload a clearer scan."
                required
              />
            </Field>
            <ButtonGroup>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReject(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={rejecting}>
                {rejecting ? "Sending…" : "Send back"}
              </Button>
            </ButtonGroup>
          </FieldGroup>
        </form>
      )}
    </FieldGroup>
  );
}
