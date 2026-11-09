"use client";

import { useActionState, useRef, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { uploadProductImages, removeProductImage, setPrimaryImage } from "@/lib/supplier/product-actions";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const boundUpload = uploadProductImages.bind(null, productId);
  const [state, action, pending] = useActionState(boundUpload, initialState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);

  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [selectedFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles(files);
  };

  const removeSelected = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      selectedFiles
        .filter((_, i) => i !== index)
        .forEach((f) => dt.items.add(f));
      fileInputRef.current.files = dt.files;
    }
  };

  const handleRemoveExisting = (path: string) => {
    setRemoving(path);
    startTransition(async () => {
      await removeProductImage(productId, path);
      setRemoving(null);
      router.refresh();
    });
  };

  const handleSetPrimary = (path: string) => {
    setSettingPrimary(path);
    startTransition(async () => {
      await setPrimaryImage(productId, path);
      setSettingPrimary(null);
      router.refresh();
    });
  };

  const totalAfterUpload = existingImages.length + selectedFiles.length;

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4"
    >
      {existingImages.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Existing images ({existingImages.length})</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {existingImages.map((img, index) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
              >
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${img.path}`}
                  alt={productTitle}
                  className="h-full w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Primary
                  </span>
                ) : null}
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {index !== 0 ? (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(img.path)}
                      disabled={settingPrimary === img.path}
                      className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                      aria-label="Set as primary"
                      title="Set as primary"
                    >
                      ★
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(img.path)}
                    disabled={removing === img.path}
                    className="flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground disabled:opacity-50"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="images">Add images</Label>
        <Input
          ref={fileInputRef}
          id="images"
          name="images"
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">
          Select one or more images (JPG, PNG, WEBP). Up to 8 total.
          {selectedFiles.length > 0
            ? ` ${selectedFiles.length} selected.`
            : ""}
        </p>
      </div>

      {previews.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Preview ({previews.length})</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((url, i) => (
              <div
                key={i}
                className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
              >
                <img
                  src={url}
                  alt={`Preview ${i + 1}`}
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeSelected(i)}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {state.message ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || selectedFiles.length === 0}>
          {pending ? "Uploading…" : "Upload images"}
        </Button>
      </div>
    </form>
  );
}
