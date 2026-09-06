"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateBusinessProfile,
  type KybActionState,
} from "@/lib/supplier/actions";

const initialState: KybActionState = { ok: false, message: "" };

export function BusinessProfileForm({
  businessName,
  contactPerson,
  logoPath,
}: {
  businessName: string;
  contactPerson: string;
  logoPath: string | null;
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
    <form action={action} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {currentLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentLogo}
            alt=""
            className="size-14 rounded-2xl border border-border object-cover"
          />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-2xl border border-border text-xs text-muted-foreground">
            No logo
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="logo">Company logo</Label>
          <Input
            id="logo"
            name="logo"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={onLogoChange}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="business_name">Company name</Label>
        <Input
          id="business_name"
          name="business_name"
          required
          minLength={2}
          defaultValue={businessName}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact_person">Contact name</Label>
        <Input
          id="contact_person"
          name="contact_person"
          required
          minLength={2}
          defaultValue={contactPerson}
        />
      </div>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "text-sm text-muted-foreground"
              : "text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function logoPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${path}`;
}
