"use client";

import { useActionState, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { addCustomer, type CustomerActionState } from "@/lib/supplier/customer-actions";

const initialState: CustomerActionState = { ok: false, message: "" };

/** Manual customer entry. Success redirects (fresh list, dialog unmounts). */
export function CustomerAddDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addCustomer, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            Add customer
          </Button>
        }
      />
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>
            Manually recorded customers start as New until they order.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="customer-name">Name</FieldLabel>
              <Input id="customer-name" name="name" required autoComplete="off" placeholder="Meera Nair" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="customer-phone">Mobile number</FieldLabel>
                <Input
                  id="customer-phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  autoComplete="tel"
                  placeholder="98765 43210"
                />
                <FieldDescription>10-digit Indian mobile number.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="customer-city">City</FieldLabel>
                <Input id="customer-city" name="city" autoComplete="off" placeholder="Bengaluru" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="customer-email">Email</FieldLabel>
              <Input
                id="customer-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="meera@example.com"
              />
              <FieldDescription>Optional — used for duplicate checks.</FieldDescription>
            </Field>
            {state.message ? (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Adding…
                </>
              ) : (
                "Add customer"
              )}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
