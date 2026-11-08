"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  updateStore,
  type StoreActionState,
} from "@/lib/admin/stores";

const initialState: StoreActionState = { ok: false, message: "" };

export function EditStoreForm({
  id,
  name,
  description,
  status,
}: {
  id: string;
  name: string;
  description: string;
  status: string;
}) {
  const [state, action, pending] = useActionState(updateStore, initialState);

  return (
    <form action={action}>
      <FieldGroup>
        <input type="hidden" name="id" value={id} />
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            defaultValue={name}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            name="description"
            defaultValue={description}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <select id="status" name="status" defaultValue={status}>
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
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FieldGroup>
    </form>
  );
}
