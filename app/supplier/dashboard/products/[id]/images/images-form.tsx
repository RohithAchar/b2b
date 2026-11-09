"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { uploadProductImages } from "@/lib/supplier/product-actions";
import type { ProductActionState } from "@/lib/supplier/product-actions";

const initialState: ProductActionState = { ok: false, message: "" };

export function ProductImagesForm({
  productId,
  productTitle,
  existingImages,
  imageCount,
  canSubmit,
}: {
  productId: string;
  productTitle: string;
  existingImages: { id: string; path: string }[];
  imageCount: number;
  canSubmit: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    (prev: ProductActionState, formData: FormData) =>
      uploadProductImages(productId, prev, formData),
    initialState,
  );
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4"
      onSubmit={() => setMessage(null)}
    >
      {existingImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {existingImages.map((img) => (
            <div
              key={img.id}
              className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${img.path}`}
                alt={productTitle}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="images">Add images</Label>
        <Input
          id="images"
          name="images"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
        />
        <p className="text-xs text-muted-foreground">
          Select one or more images (JPG, PNG, WEBP). Up to 8 total.
        </p>
      </div>

      {state.message ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload images"}
        </Button>
      </div>
    </form>
  );
}
