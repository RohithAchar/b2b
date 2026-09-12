"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import {
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const OUTPUT_WIDTHS = [1600, 1200, 960] as const;

type CropState = {
  x: number;
  y: number;
};

const initialCrop: CropState = { x: 0, y: 0 };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = url;
  });
}

type EditorStatus = "idle" | "editing" | "ready";

export function ImageUploadEditor({
  aspect,
  required = false,
  currentImageUrl = null,
  onAppliedFile,
  onStatusChange,
}: {
  aspect: number;
  required?: boolean;
  currentImageUrl?: string | null;
  onAppliedFile: (file: File | null) => void;
  onStatusChange?: (status: EditorStatus) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [status, setStatusState] = React.useState<EditorStatus>(
    currentImageUrl ? "idle" : "idle",
  );
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState<CropState>(initialCrop);
  const [zoom, setZoom] = React.useState(1);
  const [outputWidth, setOutputWidth] = React.useState<number>(OUTPUT_WIDTHS[0]);
  const [appliedPreview, setAppliedPreview] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const croppedAreaRef = React.useRef<Area | null>(null);

  const setStatus = React.useCallback(
    (next: EditorStatus) => {
      setStatusState(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  React.useEffect(() => {
    if (!appliedPreview) return;
    return () => URL.revokeObjectURL(appliedPreview);
  }, [appliedPreview]);

  React.useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function writeToInput(file: File | null) {
    if (!inputRef.current) return;
    if (!file) {
      inputRef.current.value = "";
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(file);
    inputRef.current.files = dt.files;
  }

  function handleFileChosen(file: File | null) {
    if (!file) return;
    setAppliedPreview(null);
    setCrop(initialCrop);
    setZoom(1);
    setError(null);
    setImageUrl(URL.createObjectURL(file));
    setStatus("editing");
  }

  function openPicker() {
    setError(null);
    inputRef.current?.click();
  }

  function cancelEdit() {
    writeToInput(null);
    setImageUrl(null);
    setAppliedPreview(null);
    setCrop(initialCrop);
    setZoom(1);
    setStatus("idle");
    onAppliedFile(null);
  }

  async function applyCrop() {
    const url = imageUrl;
    if (!url) return;
    const area = croppedAreaRef.current;
    if (!area || area.width < 1 || area.height < 1) {
      setError("Move or zoom so the crop is inside the image.");
      return;
    }
    setApplying(true);
    try {
      const img = await loadImage(url);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = Math.max(1, Math.round(outputWidth / aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported in this browser.");
      ctx.drawImage(
        img,
        area.x,
        area.y,
        area.width,
        area.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (!blob) throw new Error("Could not encode the image.");
      const originalName = inputRef.current?.files?.[0]?.name ?? "banner.jpg";
      const file = new File(
        [blob],
        `${originalName.replace(/\.[^.]+$/, "")}-${outputWidth}.jpg`,
        { type: "image/jpeg" },
      );
      writeToInput(file);
      setAppliedPreview(URL.createObjectURL(file));
      setImageUrl(null);
      setStatus("ready");
      onAppliedFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the image.");
    } finally {
      setApplying(false);
    }
  }

  const showStored = status === "idle" && currentImageUrl;

  return (
    <FieldGroup>
      <input
        ref={inputRef}
        name="image"
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        required={required}
        className="hidden"
        onChange={(e) => handleFileChosen(e.target.files?.[0] ?? null)}
      />
      {status === "ready" && appliedPreview ? (
        <div className="flex flex-col gap-2">
          <FieldDescription>Composed at the banner ratio:</FieldDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={appliedPreview}
            alt="Cropped banner preview"
            className="w-full rounded-xl border border-border object-cover"
            style={{ aspectRatio: String(aspect) }}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openPicker}>
              Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
              Remove
            </Button>
          </div>
        </div>
      ) : status === "editing" && imageUrl ? (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="banner-image-editor">Frame the image</FieldLabel>
          <div className="relative h-72 w-full overflow-hidden rounded-xl border border-border bg-muted">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={3}
              aspect={aspect}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_area, areaPixels) => {
                croppedAreaRef.current = areaPixels;
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-36 accent-primary"
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Output width</span>
              <NativeSelect
                value={String(outputWidth)}
                onChange={(e) => setOutputWidth(Number(e.target.value))}
                className="h-9 w-32"
              >
                {OUTPUT_WIDTHS.map((w) => (
                  <NativeSelectOption key={w} value={String(w)}>
                    {w} px
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={applyCrop} disabled={applying}>
                {applying ? "Applying…" : "Apply crop"}
              </Button>
            </div>
          </div>
          <FieldDescription>
            Drag to reposition and pinch-zoom (or use the slider) to fill the
            strip. The crop is locked to the banner ratio so the finished
            image fills the slot exactly.
          </FieldDescription>
        </div>
      ) : showStored ? (
        <div className="flex flex-col gap-2">
          <FieldDescription>Current banner:</FieldDescription>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImageUrl}
            alt="Current banner"
            className="w-full rounded-xl border border-border object-cover"
            style={{ aspectRatio: String(aspect) }}
          />
          <div>
            <Button type="button" variant="outline" size="sm" onClick={openPicker}>
              Replace image
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openPicker}>
            Choose image
          </Button>
          <FieldDescription>
            JPG, PNG or WEBP, max 5 MB. You can crop and resize it here.
          </FieldDescription>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </FieldGroup>
  );
}