"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createCategory,
  type CategoryActionState,
} from "@/lib/admin/categories";

const initialState: CategoryActionState = { ok: false, message: "" };

export function NewCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, initialState);

  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            placeholder="e.g. Footwear"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="image">
            Image (JPG, PNG or WEBP, max 5 MB)
          </FieldLabel>
          <Input
            id="image"
            name="image"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            required
          />
        </Field>
        {state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save category"}
        </Button>
      </FieldGroup>
    </form>
  );
}
