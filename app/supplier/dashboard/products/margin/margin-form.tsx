"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateMargin, type KybActionState } from "@/lib/supplier/actions";
import { MAX_MARGIN_PCT } from "@/lib/pricing";

const initialState: KybActionState = { ok: false, message: "" };

export function MarginForm({ marginPct }: { marginPct: number }) {
  const [state, action, pending] = useActionState(updateMargin, initialState);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="margin_pct">Margin on base price (%)</FieldLabel>
          <Input
            id="margin_pct"
            name="margin_pct"
            required
            type="number"
            min={0}
            max={MAX_MARGIN_PCT}
            step="0.01"
            defaultValue={marginPct}
          />
          <FieldDescription>
            Buyers see base price plus this margin. A base price of ₹100 with a
            10% margin is listed at ₹110. Applies to every product, including
            quantity pricing and variants.
          </FieldDescription>
        </Field>
        {state.message ? (
          <Alert variant={state.ok ? "default" : "destructive"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FieldGroup>
    </form>
  );
}
