import { useState, type ChangeEvent, type RefObject } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, Edit02Icon, Image01Icon } from "@hugeicons/core-free-icons";
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
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/dashboard/form-section";
import { ImageCropModal } from "@/components/dashboard/image-crop-modal";
import { cn } from "cn";
import {
  MAX_SEO_DESCRIPTION_CHARS,
  MAX_SEO_TITLE_CHARS,
  SEO_DESCRIPTION_RECOMMENDED_CHARS,
  SEO_TITLE_RECOMMENDED_CHARS,
} from "@/lib/supplier/products";
import { stripHtml } from "@/lib/supplier/rich-text";
import { SITE_URL } from "@/lib/site";
import type { ExistingProduct, FieldErrorHelpers } from "./product-form-types";

export function ProductSeoSection({
  invalidFor,
  errorFor,
  product,
  formValues,
  seoTitleTouched,
  seoDescriptionTouched,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onRegenerateSeo,
  seoFile,
  seoPreview,
  seoImageCleared,
  seoImageInputRef,
  onSeoFileChange,
  onSeoImageRemove,
  onSeoCropApplied,
  productImageUrl,
}: {
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
  product?: ExistingProduct;
  formValues: Map<string, string>;
  seoTitleTouched: boolean;
  seoDescriptionTouched: boolean;
  onSeoTitleChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
  onRegenerateSeo: () => void;
  seoFile: File | null;
  seoPreview: string | null;
  seoImageCleared: boolean;
  seoImageInputRef: RefObject<HTMLInputElement | null>;
  onSeoFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSeoImageRemove: () => void;
  onSeoCropApplied: (file: File) => void;
  productImageUrl: (path: string) => string;
}) {
  const v = (key: string, fallback: string): string => formValues.get(key) ?? fallback;

  const title = v("seo_title", "");
  const description = v("seo_description", "");
  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;

  const hasStagedSeo = seoFile != null;
  const existingSeoPath = seoImageCleared ? null : (product?.seo_image_path ?? null);
  const seoImageSrc = hasStagedSeo
    ? seoPreview
    : existingSeoPath
      ? productImageUrl(existingSeoPath)
      : null;

  const [cropOpen, setCropOpen] = useState(false);

  const previewTitle =
    title.trim() ||
    v("title", "") ||
    product?.title ||
    "Product title";
  const previewDescription =
    description.trim() ||
    stripHtml(v("description", "")) ||
    stripHtml(product?.description ?? "") ||
    "Product description.";
  const previewUrl = `${SITE_URL}/products/${product?.id ?? "…"}`;

  return (
    <FormSection
      id="product-seo"
      title="Product SEO"
      description="Optional search metadata for the public listing. Falls back to your title, description and cover image when left empty."
      columns={2}
    >
      <FieldSet>
        <FieldLegend>Search metadata</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="seo_title">Search title</FieldLabel>
            <Input id="seo_title" name="seo_title" maxLength={MAX_SEO_TITLE_CHARS} aria-invalid={invalidFor("seo_title")} value={title} onChange={(e) => onSeoTitleChange(e.target.value)} placeholder="Cotton school socks at wholesale price" />
            <FieldDescription>Around {SEO_TITLE_RECOMMENDED_CHARS} characters. Falls back to the product title.</FieldDescription>
            <p className={cn("text-xs tabular-nums", titleLength >= SEO_TITLE_RECOMMENDED_CHARS ? "text-success" : "text-muted-foreground")}>
              {titleLength} / {SEO_TITLE_RECOMMENDED_CHARS} recommended
            </p>
            {errorFor("seo_title")}
          </Field>
          <Field>
            <FieldLabel htmlFor="seo_description">Search description</FieldLabel>
            <Textarea id="seo_description" name="seo_description" rows={4} maxLength={MAX_SEO_DESCRIPTION_CHARS} aria-invalid={invalidFor("seo_description")} value={description} onChange={(e) => onSeoDescriptionChange(e.target.value)} placeholder="Wholesale cotton school socks in ankle length. MOQ 10 pairs, dispatch in 15 days…" />
            <FieldDescription>Around {SEO_DESCRIPTION_RECOMMENDED_CHARS} characters. Falls back to an excerpt of the product description.</FieldDescription>
            <p className={cn("text-xs tabular-nums", descriptionLength >= SEO_DESCRIPTION_RECOMMENDED_CHARS ? "text-success" : "text-muted-foreground")}>
              {descriptionLength} / {SEO_DESCRIPTION_RECOMMENDED_CHARS} recommended
            </p>
            {errorFor("seo_description")}
          </Field>
          <Field>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <FieldDescription>
                {seoTitleTouched || seoDescriptionTouched
                  ? "You are editing SEO fields manually — they stay as you wrote them."
                  : "SEO fields auto-fill from your title and description until you type in them."}
              </FieldDescription>
              <Button type="button" variant="outline" size="sm" onClick={onRegenerateSeo}>
                Regenerate from content
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Search image</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="seo_image">Social preview image</FieldLabel>
            <input
              ref={seoImageInputRef}
              id="seo_image"
              name="seo_image"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              hidden
              onChange={onSeoFileChange}
            />
            <FieldDescription>
              JPG, PNG or WEBP under 2 MB. Stored separately from your gallery — it never counts toward the 3-image minimum for submission.
            </FieldDescription>
            <AttachmentGroup>
              <Attachment orientation="vertical" state="done">
                <AttachmentMedia variant="image">
                  {seoImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seoImageSrc} alt="Search preview image" />
                  ) : (
                    <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                  )}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{seoImageSrc ? "Search image" : "No search image"}</AttachmentTitle>
                  <AttachmentDescription>
                    {seoImageSrc ? (seoFile ? "Ready to save" : "Saved") : "Falls back to your cover image"}
                  </AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction type="button" aria-label="Edit search image" onClick={() => setCropOpen(true)}>
                    <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                  </AttachmentAction>
                  <AttachmentAction type="button" aria-label="Choose search image" onClick={() => seoImageInputRef.current?.click()}>
                    <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                  </AttachmentAction>
                  {seoImageSrc ? (
                    <AttachmentAction type="button" aria-label="Remove search image" onClick={onSeoImageRemove}>
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                    </AttachmentAction>
                  ) : null}
                </AttachmentActions>
              </Attachment>
            </AttachmentGroup>
            {seoFile ? (
              <FieldDescription>
                {seoFile.name} · {Math.max(1, Math.round(seoFile.size / 1024))} KB
              </FieldDescription>
            ) : null}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet className="col-span-full">
        <Field>
          <FieldLabel>Search preview</FieldLabel>
          <FieldDescription>How search engines and social platforms may show this listing.</FieldDescription>
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Google preview</p>
            <p className="mt-2 line-clamp-1 text-base font-medium text-foreground">{previewTitle || "Product title"}</p>
            <p className="mt-0.5 text-sm text-success">{previewUrl}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{previewDescription}</p>
          </div>
        </Field>
      </FieldSet>
      <ImageCropModal
        open={cropOpen}
        source={seoImageSrc}
        sourceName={seoFile?.name ?? "search-image.jpg"}
        title="Edit search image"
        onClose={() => setCropOpen(false)}
        onApplied={onSeoCropApplied}
      />
    </FormSection>
  );
}