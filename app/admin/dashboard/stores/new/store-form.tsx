"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createStore,
  type StoreActionState,
} from "@/lib/admin/stores";

const initialState: StoreActionState = { ok: false, message: "" };

export function NewStoreForm() {
  const [state, action, pending] = useActionState(createStore, initialState);

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
            placeholder="e.g. D2H Select"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            placeholder="Short description of this storefront"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <select id="status" name="status" defaultValue="active">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        {state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save store"}
        </Button>
      </FieldGroup>
    </form>
  );
}
