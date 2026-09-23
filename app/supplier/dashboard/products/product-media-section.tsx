import { useMemo, useState, type RefObject } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, CloudIcon, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
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
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/dashboard/form-section";
import { ImageCropModal } from "@/components/dashboard/image-crop-modal";
import { MAX_PRODUCT_IMAGES, MIN_PRODUCT_IMAGES, youtubeThumbUrl } from "@/lib/supplier/products";
import type { ExistingImage, FieldErrorHelpers } from "./product-form-types";

export function ProductMediaSection({
  fileInputRef,
  onFilesPicked,
  existingImages,
  newFiles,
  previewUrls,
  removedImagePaths,
  totalImages,
  canAddMore,
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

  function onDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    onFilesPicked(Array.from(e.dataTransfer.files ?? []));
  }

  return (
    <FormSection
      id="product-media"
      title="Product media"
      description="JPG, PNG or WEBP, under 2 MB each. Add 3–8 images — the first image is the cover. A YouTube walkthrough is optional."
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
        <AttachmentGroup>
          {visibleExisting.map((img, i) => (
            <Attachment key={img.id} orientation="vertical" state="done">
              <AttachmentActions>
                <AttachmentAction type="button" aria-label="Edit image" onClick={() => openExistingCrop(img)}>
                  <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                </AttachmentAction>
                <AttachmentAction type="button" aria-label="Remove image" onClick={() => onRemoveExisting(img.path)}>
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </AttachmentAction>
              </AttachmentActions>
              <AttachmentMedia variant="image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImageUrl(img.path)} alt={`Product image ${i + 1}`} />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{i === 0 ? "Cover" : `Image ${i + 1}`}</AttachmentTitle>
                <AttachmentDescription>Saved</AttachmentDescription>
              </AttachmentContent>
            </Attachment>
          ))}
          {newFiles.map((file, i) => {
            const globalIndex = visibleExisting.length + i;
            return (
              <Attachment key={`${file.name}-${i}`} orientation="vertical" state="done">
                <AttachmentActions>
                  <AttachmentAction type="button" aria-label={`Edit ${file.name}`} onClick={() => openStagedCrop(i)}>
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                  </AttachmentAction>
                  <AttachmentAction
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemoveStaged(i)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </AttachmentAction>
                </AttachmentActions>
                <AttachmentMedia variant="image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrls[i]} alt={`New upload ${globalIndex + 1}`} />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{globalIndex === 0 ? "Cover" : `Image ${globalIndex + 1}`}</AttachmentTitle>
                  <AttachmentDescription>
                    {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
                  </AttachmentDescription>
                </AttachmentContent>
              </Attachment>
            );
          })}
        </AttachmentGroup>
        {canAddMore ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Add product images"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="grid min-h-44 w-full cursor-pointer place-items-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-8 text-center transition-colors hover:border-ring/60 hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <div>
              <HugeiconsIcon icon={CloudIcon} strokeWidth={2} className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Click to upload or drag &amp; drop</p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG or WEBP, under 2 MB each · {MAX_PRODUCT_IMAGES - totalImages} slot
                {MAX_PRODUCT_IMAGES - totalImages === 1 ? "" : "s"} left
              </p>
            </div>
          </div>
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
                    <img src={youtubeThumbUrl(youtubeId)} alt="YouTube preview" />
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