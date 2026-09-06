"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitKyb, type KybActionState } from "@/lib/supplier/actions";
import { KYB_STEP_FIELDS, kybStepSchemas } from "@/lib/supplier/kyb";

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
  gst_certificate_path: string | null;
  pan_card_path: string | null;
  license_path: string | null;
} | null;

const STEPS = ["Business", "Tax IDs", "Bank", "Documents"] as const;

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

function DocField({
  id,
  label,
  uploaded,
  required,
}: {
  id: string;
  label: string;
  uploaded: boolean;
  required: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {uploaded ? (
          <span className="ml-2 text-xs text-muted-foreground">
            (uploaded — choose a file to replace)
          </span>
        ) : null}
      </Label>
      <Input
        id={id}
        name={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc"
        required={required}
      />
    </div>
  );
}

export function OnboardingForm({ existing }: { existing: ExistingCompany }) {
  const [state, action, pending] = useActionState(submitKyb, initialState);
  const [step, setStep] = useState(0);
  const [fieldError, setFieldError] = useState<{
    field: string;
    message: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Validate only the visible step. Sections stay mounted (CSS-hidden) so
  // values and chosen files survive navigation — never conditionally render.
  function goNext() {
    const form = formRef.current;
    if (!form) {
      return;
    }
    const section = form.querySelector(`[data-step="${step}"]`);
    const fields = section?.querySelectorAll("input, textarea") ?? [];
    for (const field of fields) {
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement
      ) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return;
        }
      }
    }
    // Same zod rules as the server, scoped to this step's fields.
    const data = new FormData(form);
    const values: Record<string, unknown> = {};
    for (const name of KYB_STEP_FIELDS[step] ?? []) {
      values[name] = data.get(name);
    }
    const parsed = kybStepSchemas[step]?.safeParse(values);
    if (parsed && !parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue ? String(issue.path[0] ?? "") : "";
      setFieldError({ field, message: issue?.message ?? "Invalid value." });
      form.querySelector<HTMLElement>(`#${CSS.escape(field)}`)?.focus();
      return;
    }
    setFieldError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setFieldError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        // Implicit submits (Enter key, mobile "Go") must advance the wizard,
        // not post. Only the last step is allowed to submit.
        if (step !== STEPS.length - 1) {
          e.preventDefault();
          goNext();
        }
      }}
      className="flex flex-col gap-6"
    >
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <span
              className={
                i === step
                  ? "text-xs font-medium"
                  : "text-xs text-muted-foreground"
              }
            >
              {i + 1}. {label}
            </span>
            <span
              className={
                i <= step ? "h-1 rounded-full bg-primary" : "h-1 rounded-full bg-muted"
              }
            />
          </li>
        ))}
      </ol>

      <div
        data-step={0}
        className={step === 0 ? "flex flex-col gap-4" : "hidden"}
      >
        <TextField id="business_name" label="Business name" existing={existing?.business_name} error={fieldError?.field === "business_name" ? fieldError.message : null} required />
        <TextField id="contact_person" label="Contact person" existing={existing?.contact_person} error={fieldError?.field === "contact_person" ? fieldError.message : null} required />
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
          <Label htmlFor="address">Registered address</Label>
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
          <TextField id="city" label="City" existing={existing?.city} error={fieldError?.field === "city" ? fieldError.message : null} required />
          <TextField id="state" label="State" existing={existing?.state} error={fieldError?.field === "state" ? fieldError.message : null} required />
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

      <div
        data-step={1}
        className={step === 1 ? "flex flex-col gap-4" : "hidden"}
      >
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

      <div
        data-step={2}
        className={step === 2 ? "flex flex-col gap-4" : "hidden"}
      >
        <TextField
          id="bank_account"
          label="Account number"
          existing={existing?.bank_account}
          error={fieldError?.field === "bank_account" ? fieldError.message : null}
          inputMode="numeric"
          required
        />
        <TextField
          id="bank_ifsc"
          label="IFSC"
          existing={existing?.bank_ifsc}
          error={fieldError?.field === "bank_ifsc" ? fieldError.message : null}
          placeholder="HDFC0001234"
          required
        />
      </div>

      <div
        data-step={3}
        className={step === 3 ? "flex flex-col gap-4" : "hidden"}
      >
        <p className="text-sm text-muted-foreground">
          PDF, JPG, PNG or DOC, max 10 MB each. All three documents are required.
        </p>
        <DocField
          id="gst_certificate"
          label="GST certificate"
          uploaded={Boolean(existing?.gst_certificate_path)}
          required={!existing?.gst_certificate_path}
        />
        <DocField
          id="pan_card"
          label="PAN card"
          uploaded={Boolean(existing?.pan_card_path)}
          required={!existing?.pan_card_path}
        />
        <DocField
          id="license"
          label="Business license"
          uploaded={Boolean(existing?.license_path)}
          required={!existing?.license_path}
        />
      </div>

      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <div className="flex gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={goBack}
          >
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" className="flex-1" onClick={goNext}>
            Continue
          </Button>
        ) : (
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Submitting…" : "Submit for verification"}
          </Button>
        )}
      </div>
    </form>
  );
}
