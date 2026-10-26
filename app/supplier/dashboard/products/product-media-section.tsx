import { useMemo, useState, type RefObject } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, CheckmarkCircle01Icon, CloudUploadIcon, Delete02Icon, Edit02Icon, PlusSignIcon, StarIcon } from "@hugeicons/core-free-icons";
import {
  Attachment,
  AttachmentActions,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/dashboard/form-section";
import dynamic from "next/dynamic";
import { cn } from "cn";
import { MAX_PRODUCT_IMAGES, MIN_PRODUCT_IMAGES, existingImageKey, stagedImageKey, youtubeThumbUrl } from "@/lib/supplier/products";
import type { ExistingImage, FieldErrorHelpers } from "./product-form-types";

const ImageCropModal = dynamic(
  () => import("@/components/dashboard/image-crop-modal").then((m) => m.ImageCropModal),
  { ssr: false },
);

type GalleryItem =
  | {
      key: string;
      kind: "existing";
      url: string;
      name: string;
      meta: string;
      image: ExistingImage;
    }
  | {
      key: string;
      kind: "staged";
      url: string;
      name: string;
      meta: string;
      file: File;
      index: number;
    };

export function ProductMediaSection({
  fileInputRef,
  onFilesPicked,
  existingImages,
  newFiles,
  previewUrls,
  removedImagePaths,
  totalImages,
  canAddMore,
  primaryImageKey,
  onMakePrimary,
  onRemoveStaged,
  onRemoveExisting,
  onReplaceStaged,
  onReplaceExisting,
  productImageUrl,
  youtubeUrl,
  onYoutubeChange,
  youtubeId,
  invalidFor,
  errorFor,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesPicked: (files: File[]) => void;
  existingImages: ExistingImage[];
  newFiles: File[];
  previewUrls: string[];
  removedImagePaths: string[];
  totalImages: number;
  canAddMore: boolean;
  primaryImageKey: string | null;
  onMakePrimary: (key: string) => void;
  onRemoveStaged: (index: number) => void;
  onRemoveExisting: (path: string) => void;
  onReplaceStaged: (index: number, file: File) => void;
  onReplaceExisting: (path: string, file: File) => void;
  productImageUrl: (path: string) => string;
  youtubeUrl: string;
  onYoutubeChange: (value: string) => void;
  youtubeId: string | null;
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
}) {
  const visibleExisting = useMemo(
    () => existingImages.filter((img) => !removedImagePaths.includes(img.path)),
    [existingImages, removedImagePaths],
  );
  const gallery = useMemo<GalleryItem[]>(
    () => [
      ...visibleExisting.map((image, index) => ({
        key: existingImageKey(image.path),
        kind: "existing" as const,
        url: productImageUrl(image.path),
        name: `Saved image ${index + 1}`,
        meta: "Stored in your gallery",
        image,
      })),
      ...newFiles.map((file, index) => ({
        key: stagedImageKey(index),
        kind: "staged" as const,
        url: previewUrls[index] ?? "",
        name: file.name,
        meta: `${Math.max(1, Math.round(file.size / 1024))} KB · ready to upload`,
        file,
        index,
      })),
    ],
    [visibleExisting, newFiles, previewUrls, productImageUrl],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected =
    gallery.find((item) => item.key === selectedKey) ??
    gallery.find((item) => item.key === primaryImageKey) ??
    gallery[0] ??
    null;
  const [cropTarget, setCropTarget] = useState<
    { kind: "existing"; path: string } | { kind: "staged"; index: number } | null
  >(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropName, setCropName] = useState<string | null>(null);

  function openExistingCrop(img: ExistingImage) {
    setCropTarget({ kind: "existing", path: img.path });
    setCropSource(productImageUrl(img.path));
    setCropName(img.path.split("/").pop() ?? "image.jpg");
  }

  function openStagedCrop(index: number) {
    setCropTarget({ kind: "staged", index });
    setCropSource(previewUrls[index]);
    setCropName(newFiles[index]?.name ?? "image");
  }

  function applyCrop(file: File) {
    if (cropTarget?.kind === "existing") onReplaceExisting(cropTarget.path, file);
    else if (cropTarget?.kind === "staged") onReplaceStaged(cropTarget.index, file);
    setCropTarget(null);
  }

  function openGalleryCrop(item: GalleryItem) {
    if (item.kind === "existing") openExistingCrop(item.image);
    else openStagedCrop(item.index);
  }

  function removeGalleryItem(item: GalleryItem) {
    if (item.kind === "existing") onRemoveExisting(item.image.path);
    else onRemoveStaged(item.index);
  }

  function onDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    onFilesPicked(Array.from(e.dataTransfer.files ?? []));
  }

  return (
    <FormSection
      id="product-media"
      title="Product media"
      description="JPG, PNG or WEBP, under 2 MB each. Add 3–8 images and choose which one is the primary cover. A YouTube walkthrough is optional."
      columns={1}
    >
      <FieldSet>
        <FieldLegend>Images</FieldLegend>
        <Field>
          <FieldLabel htmlFor="images">Product images</FieldLabel>
          <input
            ref={fileInputRef}
            id="images"
            name="images"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            hidden
            aria-invalid={invalidFor("images")}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              onFilesPicked(picked);
            }}
          />
          {totalImages === 0 ? (
            <FieldDescription>
              No images yet — add at least 3 clear photos before submitting for approval.
            </FieldDescription>
          ) : (
            <FieldDescription>
              {totalImages} of {MAX_PRODUCT_IMAGES} images
              {totalImages < MIN_PRODUCT_IMAGES ? ` — add at least ${MIN_PRODUCT_IMAGES - totalImages} more` : null}
            </FieldDescription>
          )}
          {errorFor("images")}
        </Field>
        {selected ? (
          <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-md border border-border bg-muted sm:mx-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  loading="lazy"
                  decoding="async"
                  src={selected.url}
                  alt={selected.name}
                  className="h-full w-full object-contain"
                />
                {selected.key === primaryImageKey ? (
                  <Badge className="absolute top-2 left-2 gap-1" variant="default">
                    <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-3.5" />
                    Primary
                  </Badge>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{selected.name}</p>
                  <p className="text-xs text-muted-foreground">{selected.meta}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openGalleryCrop(selected)}>
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
                    Edit
                  </Button>
                  {selected.key !== primaryImageKey ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onMakePrimary(selected.key)}>
                      <HugeiconsIcon icon={StarIcon} strokeWidth={2} data-icon="inline-start" />
                      Make primary
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeGalleryItem(selected)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
                    Remove
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The primary image is the cover used in listings, search and product cards.
                </p>
              </div>
            </div>
            {gallery.length > 1 ? (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {gallery.map((item, index) => {
                  const isSelected = item.key === selected.key;
                  const isPrimary = item.key === primaryImageKey;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedKey(item.key)}
                      aria-label={`Preview image ${index + 1}`}
                      aria-current={isSelected}
                      className={cn(
                        "relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        isSelected ? "border-primary" : "border-border hover:border-primary/50",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        loading="lazy"
                        decoding="async"
                        src={item.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {isPrimary ? (
                        <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                          <HugeiconsIcon icon={StarIcon} strokeWidth={2} className="size-3.5" />
                          <span className="sr-only">Primary</span>
                        </span>
                      ) : null}
                      {isSelected ? (
                        <span className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-3.5" />
                          <span className="sr-only">Selected</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {canAddMore ? (
          <Empty
            className="border"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={CloudUploadIcon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>Upload product images</EmptyTitle>
              <EmptyDescription>
                JPG, PNG or WEBP, under 2 MB each · {MAX_PRODUCT_IMAGES - totalImages} slot
                {MAX_PRODUCT_IMAGES - totalImages === 1 ? "" : "s"} left. You can also drag
                &amp; drop files here.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
                Add images
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <FieldDescription>
            You&apos;ve reached the {MAX_PRODUCT_IMAGES}-image limit. Remove one to add another, or re-crop an existing image.
          </FieldDescription>
        )}
      </FieldSet>
      <FieldSet>
        <FieldLegend>Video (optional)</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="youtube_url">YouTube link</FieldLabel>
            <Input id="youtube_url" name="youtube_url" type="url" maxLength={200} aria-invalid={invalidFor("youtube_url")} value={youtubeUrl} onChange={(e) => onYoutubeChange(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            <FieldDescription>Link only — we never upload video files.</FieldDescription>
            {errorFor("youtube_url")}
          </Field>
          {youtubeId ? (
            <Field>
              <FieldLabel>Video preview</FieldLabel>
              <AttachmentGroup>
                <Attachment orientation="horizontal" state="done">
                  <AttachmentMedia variant="image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={youtubeThumbUrl(youtubeId)} alt="YouTube preview" />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>Video attached</AttachmentTitle>
                    <AttachmentDescription>{youtubeId}</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label="Watch video on YouTube"
                      render={<a href={youtubeUrl} target="_blank" rel="noopener noreferrer" />}
                      nativeButton={false}
                    >
                      <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              </AttachmentGroup>
            </Field>
          ) : null}
        </FieldGroup>
      </FieldSet>
      <ImageCropModal
        open={cropTarget !== null}
        source={cropSource}
        sourceName={cropName}
        title="Edit product image"
        onClose={() => setCropTarget(null)}
        onApplied={applyCrop}
      />
    </FormSection>
  );
}