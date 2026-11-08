"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitKyb, type KybActionState } from "@/lib/supplier/actions";
import { kybSchema } from "@/lib/supplier/kyb";

const initialState: KybActionState = { ok: false, message: "" };

export type ExistingCompany = {
  business_name: string | null;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  logo_path: string | null;
} | null;

export function OnboardingForm({
  title,
  description,
  existing,
}: {
  title: string;
  description: string;
  existing: ExistingCompany;
}) {
  const [state, action, pending] = useActionState(submitKyb, initialState);
  const [fieldError, setFieldError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function clientValidate(): boolean {
    const form = formRef.current;
    if (!form) return true;
    const data = new FormData(form);
    const parsed = kybSchema.safeParse({
      business_name: data.get("business_name"),
      contact_person: data.get("contact_person"),
      phone: data.get("phone"),
      address: data.get("address"),
      city: data.get("city"),
      state: data.get("state"),
      pincode: data.get("pincode"),
      gstin: data.get("gstin"),
      pan: data.get("pan"),
      bank_account: data.get("bank_account"),
      bank_ifsc: data.get("bank_ifsc"),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue ? String(issue.path[0] ?? "") : "";
      setFieldError({ field, message: issue?.message ?? "Invalid value." });
      form.querySelector<HTMLElement>(`#${CSS.escape(field)}`)?.focus();
      return false;
    }
    setFieldError(null);
    return true;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={action}
          onSubmit={(e) => {
            if (!clientValidate()) e.preventDefault();
          }}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-4">
            <TextField
              id="business_name"
              label="Business name"
              existing={existing?.business_name}
              error={fieldError?.field === "business_name" ? fieldError.message : null}
              required
            />
            <TextField
              id="contact_person"
              label="Contact person"
              existing={existing?.contact_person}
              error={fieldError?.field === "contact_person" ? fieldError.message : null}
              required
            />
            <TextField
              id="phone"
              label="Mobile number"
              existing={existing?.phone}
              error={fieldError?.field === "phone" ? fieldError.message : null}
              inputMode="numeric"
              placeholder="9876543210"
              required
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Business address</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={existing?.address ?? ""}
                aria-invalid={fieldError?.field === "address"}
                required
              />
              {fieldError?.field === "address" ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldError.message}
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <TextField
                id="city"
                label="City"
                existing={existing?.city}
                error={fieldError?.field === "city" ? fieldError.message : null}
                required
              />
              <TextField
                id="state"
                label="State"
                existing={existing?.state}
                error={fieldError?.field === "state" ? fieldError.message : null}
                required
              />
              <TextField
                id="pincode"
                label="Pincode"
                existing={existing?.pincode}
                error={fieldError?.field === "pincode" ? fieldError.message : null}
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Tax and bank details are required to activate your business.
            </p>
            <TextField
              id="gstin"
              label="GSTIN"
              existing={existing?.gstin}
              error={fieldError?.field === "gstin" ? fieldError.message : null}
              placeholder="22AAAAA0000A1Z5"
              required
            />
            <TextField
              id="pan"
              label="PAN"
              existing={existing?.pan}
              error={fieldError?.field === "pan" ? fieldError.message : null}
              placeholder="AAAAA0000A"
              required
            />
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Bank details are required to set up payouts for your business.
            </p>
            <TextField
              id="bank_account"
              label="Bank account number"
              existing={existing?.bank_account ?? undefined}
              error={fieldError?.field === "bank_account" ? fieldError.message : null}
              inputMode="numeric"
              placeholder="12345678901"
              required
            />
            <TextField
              id="bank_ifsc"
              label="Bank IFSC"
              existing={existing?.bank_ifsc ?? undefined}
              error={fieldError?.field === "bank_ifsc" ? fieldError.message : null}
              placeholder="HDFC0001234"
              required
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="logo">Company logo</Label>
              <Input
                id="logo"
                name="logo"
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
              />
            </div>
          </div>

          {state.message ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Activating…" : "Activate supplier account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  existing,
  error,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string;
  label: string;
  existing?: string | null;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        defaultValue={existing ?? ""}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}