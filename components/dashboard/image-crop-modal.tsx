"use client";

import { useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OUTPUT_WIDTH = 1600;
const OUTPUT_QUALITY = 0.9;
const CROP_ASPECT = 4 / 3;

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = (rotation * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rotRad)) * width + Math.abs(Math.sin(rotRad)) * height,
    height: Math.abs(Math.sin(rotRad)) * width + Math.abs(Math.cos(rotRad)) * height,
  };
}

/**
 * Resolve a URL to a drawable image while honoring EXIF orientation (matters
 * for phone photos). Falls back to <img> where createImageBitmap is missing.
 */
async function loadOrientedImage(url: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function" && typeof ImageBitmap !== "undefined") {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the classic <img> loader.
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = url;
  });
}

async function cropOrientedImage(
  source: string,
  area: Area,
  rotation: number,
): Promise<Blob> {
  const image = await loadOrientedImage(source);
  const rotRad = ((rotation % 360) * Math.PI) / 180;
  const { width: bboxWidth, height: bboxHeight } = rotateSize(
    image.width,
    image.height,
    rotation % 360,
  );

  const rotated = document.createElement("canvas");
  rotated.width = bboxWidth;
  rotated.height = bboxHeight;
  const rotatedCtx = rotated.getContext("2d");
  if (!rotatedCtx) throw new Error("Canvas is not supported in this browser.");
  rotatedCtx.translate(bboxWidth / 2, bboxHeight / 2);
  rotatedCtx.rotate(rotRad);
  rotatedCtx.translate(-image.width / 2, -image.height / 2);
  rotatedCtx.drawImage(image, 0, 0);

  const scaleX = OUTPUT_WIDTH / area.width;
  const cropped = document.createElement("canvas");
  cropped.width = OUTPUT_WIDTH;
  cropped.height = Math.max(1, Math.round(area.height * scaleX));
  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas is not supported in this browser.");
  croppedCtx.drawImage(
    rotated,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    cropped.toBlob(resolve, "image/jpeg", OUTPUT_QUALITY),
  );
  if (!blob) throw new Error("Could not encode the image.");
  return blob;
}

export function ImageCropModal({
  open,
  source,
  sourceName,
  title = "Edit image",
  onClose,
  onApplied,
}: {
  open: boolean;
  source: string | null;
  sourceName?: string | null;
  title?: string;
  onClose: () => void;
  onApplied: (file: File) => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (typeof next === "boolean" && !next && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Drag to reposition; use the sliders to zoom and rotate. The result is
            saved as a JPEG around 1600 px wide.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <CropStage
            source={source}
            sourceName={sourceName}
            reportBusy={setBusy}
            onClose={onClose}
            onApplied={onApplied}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Owns the live crop/zoom/rotation state. Mounted only while the dialog is
 * open, so state is fresh on every open.
 */
function CropStage({
  source,
  sourceName,
  reportBusy,
  onClose,
  onApplied,
}: {
  source: string | null;
  sourceName?: string | null;
  reportBusy: (busy: boolean) => void;
  onClose: () => void;
  onApplied: (file: File) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedAreaRef = useRef<Area | null>(null);

  async function applyCrop() {
    if (!source) return;
    const area = completedAreaRef.current;
    if (!area || area.width < 1 || area.height < 1) {
      setError("Move or zoom so the crop is fully inside the image.");
      return;
    }
    setBusy(true);
    reportBusy(true);
    setError(null);
    try {
      const blob = await cropOrientedImage(source, area, rotation);
      const baseName =
        (sourceName ?? "image")
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
      onApplied(new File([blob], `${baseName}-${OUTPUT_WIDTH}.jpg`, { type: "image/jpeg" }));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process the image.");
    } finally {
      setBusy(false);
      reportBusy(false);
    }
  }

  return (
    <>
      {source ? (
        <>
          <div className="relative h-80 w-full overflow-hidden rounded-lg border border-border bg-muted">
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              minZoom={1}
              maxZoom={3}
              aspect={CROP_ASPECT}
              objectFit="contain"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_area, areaPixels) => {
                completedAreaRef.current = areaPixels;
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
              <span className="text-muted-foreground">Rotate</span>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-36 accent-primary"
              />
              <span className="w-9 text-xs tabular-nums text-muted-foreground">
                {rotation}°
              </span>
            </label>
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter showCloseButton>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={applyCrop} disabled={busy || !source}>
          {busy ? "Applying…" : "Apply crop"}
        </Button>
      </DialogFooter>
    </>
  );
}