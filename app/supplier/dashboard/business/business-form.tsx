"use client";

import { useActionState, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  updateBusinessProfile,
  type KybActionState,
} from "@/lib/supplier/actions";
import { MAX_MARGIN_PCT } from "@/lib/pricing";

const initialState: KybActionState = { ok: false, message: "" };

export function BusinessProfileForm({
  businessName,
  contactPerson,
  logoPath,
  marginPct,
}: {
  businessName: string;
  contactPerson: string;
  logoPath: string | null;
  marginPct: number;
}) {
  const [state, action, pending] = useActionState(
    updateBusinessProfile,
    initialState,
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLogoPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
        objectUrlsRef.current = objectUrlsRef.current.filter(
          (u) => u !== prev,
        );
      }
      if (!file) {
        return null;
      }
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return url;
    });
  }

  const currentLogo =
    logoPreview ??
    (logoPath ? logoPublicUrl(logoPath) : null);

  return (
    <form action={action}>
      <FieldGroup>
        <Item variant="outline">
          <ItemMedia variant="image">
            {currentLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentLogo} alt="" />
            ) : null}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{businessName}</ItemTitle>
            <ItemDescription>
              {currentLogo ? "Choose a file to replace the logo." : "No logo yet."}
            </ItemDescription>
          </ItemContent>
        </Item>
        <Field>
          <FieldLabel htmlFor="logo">Company logo</FieldLabel>
          <Input
            id="logo"
            name="logo"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={onLogoChange}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="business_name">Company name</FieldLabel>
          <Input
            id="business_name"
            name="business_name"
            required
            minLength={2}
            defaultValue={businessName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact_person">Contact name</FieldLabel>
          <Input
            id="contact_person"
            name="contact_person"
            required
            minLength={2}
            defaultValue={contactPerson}
          />
        </Field>
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

function logoPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${path}`;
}
