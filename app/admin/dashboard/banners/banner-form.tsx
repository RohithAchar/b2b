"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { type BannerActionState } from "@/lib/admin/banners";
import { SLOT_ASPECTS, SLOT_LABELS, type BannerSlot } from "@/lib/admin/banner-slots";
import { ImageUploadEditor } from "./image-upload-editor";

const initialState: BannerActionState = { ok: false, message: "" };

type BannerFormProps = {
  action: (
    prev: BannerActionState,
    formData: FormData,
  ) => Promise<BannerActionState | never>;
  id?: string;
  slot: BannerSlot;
  title?: string;
  subtitle?: string;
  linkUrl?: string;
  imageRequired?: boolean;
  currentImageUrl?: string | null;
};

export function BannerForm({
  action,
  id,
  slot,
  title = "",
  subtitle = "",
  linkUrl = "",
  imageRequired = false,
  currentImageUrl = null,
}: BannerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [selectedSlot, setSelectedSlot] = useState<BannerSlot>(slot);

  return (
    <form action={formAction}>
      <FieldGroup>
        {id ? <input type="hidden" name="id" value={id} /> : null}
        {/* The select is disabled while editing so the slot cannot change,
            and disabled controls are not submitted. Carry it explicitly. */}
        {id ? <input type="hidden" name="slot" value={selectedSlot} /> : null}
        <Field>
          <FieldLabel htmlFor="slot">Position</FieldLabel>
          <NativeSelect
            id="slot"
            name="slot"
            value={selectedSlot}
            disabled={Boolean(id)}
            onChange={(e) => setSelectedSlot(e.target.value as BannerSlot)}
          >
            {(["hero", "promo"] as BannerSlot[]).map((value) => (
              <NativeSelectOption key={value} value={value}>
                {SLOT_LABELS[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="title">Title (optional)</FieldLabel>
          <Input
            id="title"
            name="title"
            maxLength={80}
            placeholder="e.g. Monsoon clearance"
            defaultValue={title}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="subtitle">Subtitle (optional)</FieldLabel>
          <Input
            id="subtitle"
            name="subtitle"
            maxLength={160}
            placeholder="e.g. Up to 30% off on packaging supplies"
            defaultValue={subtitle}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="link_url">
            Link (optional — a full URL like https://… or a page like /products)
          </FieldLabel>
          <Input
            id="link_url"
            name="link_url"
            placeholder="https://example.com/campaign"
            defaultValue={linkUrl}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="image">Image</FieldLabel>
          <ImageUploadEditor
            key={selectedSlot}
            aspect={SLOT_ASPECTS[selectedSlot]}
            required={imageRequired}
            currentImageUrl={currentImageUrl}
            onAppliedFile={() => {}}
            onStatusChange={() => {}}
          />
        </Field>
        {state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : id ? "Save changes" : "Save banner"}
        </Button>
      </FieldGroup>
    </form>
  );
}