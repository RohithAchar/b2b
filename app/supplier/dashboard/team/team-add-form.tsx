"use client";

import { useEffect, useRef, useActionState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addStaff, type StaffActionState } from "@/lib/supplier/staff-actions";

const initialState: StaffActionState = { ok: false, message: "" };

export function TeamAddForm() {
  const [state, action, pending] = useActionState(addStaff, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <FieldGroup>
        <Field data-invalid={state.field === "email" && !state.ok ? true : undefined}>
          <FieldLabel htmlFor="email">Email address</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            aria-invalid={state.field === "email" && !state.ok ? true : undefined}
            placeholder="staff@example.com"
          />
          <FieldDescription>
            They must already have an account — new signups can&apos;t be added until then.
          </FieldDescription>
          {state.field === "email" && !state.ok ? (
            <FieldError>{state.message}</FieldError>
          ) : null}
        </Field>
        {state.message && (!state.field || state.ok) ? (
          <Alert variant={state.ok ? "default" : "destructive"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
            )}
            {pending ? "Adding…" : "Add team member"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
