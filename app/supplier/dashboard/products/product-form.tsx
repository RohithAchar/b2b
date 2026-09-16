"use client";

import { useActionState, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Image01Icon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/dashboard/form-section";
import {
  createProduct,
  updateProduct,
  type ProductActionState,
} from "@/lib/supplier/product-actions";
import {
  MAX_PRODUCT_IMAGES,
  PRODUCT_GST_RATES,
  PRODUCT_UNITS,
  extractYoutubeId,
  youtubeThumbUrl,
  type ProductVariantValues,
} from "@/lib/supplier/products";

export type CategoryOption = {
  id: string;
  name: string;
  parentName: string | null;
};

export type ExistingVariant = ProductVariantValues & { id?: string };

export type ExistingProduct = {
  id: string;
  title: string;
  category_id: string;
  brand: string | null;
  seller_sku: string;
  hsn_code: string;
  description: string;
  unit: string;
  price_per_unit: number;
  moq: number;
  stock_qty: number;
  negotiable: boolean;
  sample_available: boolean;
  sample_price: number | null;
  lead_time_days: number;
  gst_rate: number | null;
  packaging_details: string | null;
  warranty_return: string | null;
  youtube_url: string | null;
  status: string;
  images: { id: string; path: string }[];
  variants: ExistingVariant[];
};

const initialState: ProductActionState = { ok: false, message: "" };

function productImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${path}`;
}

function newVariant(): ExistingVariant {
  return {
    label: "",
    attr_key: "",
    attr_value: "",
    seller_sku: "",
    price: 0,
    moq: null,
    stock_qty: 0,
  };
}

export function ProductForm({
  mode,
  product,
  categories,
  title,
  description,
}: {
  mode: "create" | "edit";
  product?: ExistingProduct;
  categories: CategoryOption[];
  title: string;
  description: string;
}) {
  const boundAction =
    mode === "create"
      ? createProduct
      : updateProduct.bind(null, product?.id ?? "");
  const [state, action, pending] = useActionState(boundAction, initialState);
  const [invalidField, setInvalidField] = useState<{ id: string; message: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Submission gate: the browser never POSTs unless our own code sets this
  // flag after explicit validation. Any stray submit (wrong button type,
  // Enter key, extension) is intercepted below and routed to validation.
  const allowSubmitRef = useRef(false);
  // When set, the next allowed POST additionally requests submission for
  // approval right after saving.
  const autoSubmitRef = useRef(false);

  const [negotiable, setNegotiable] = useState(product?.negotiable ?? false);
  const [sampleAvailable, setSampleAvailable] = useState(product?.sample_available ?? false);
  const [hasVariants, setHasVariants] = useState((product?.variants?.length ?? 0) > 0);
  const [variants, setVariants] = useState<ExistingVariant[]>(product?.variants ?? []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState(product?.youtube_url ?? "");
  const objectUrlsRef = useRef<string[]>([]);

  const youtubeId = useMemo(() => extractYoutubeId(youtubeUrl), [youtubeUrl]);
  const existingImages = useMemo(() => product?.images ?? [], [product]);
  const totalImages = existingImages.length + newFiles.length;
  const canAddMore = totalImages < MAX_PRODUCT_IMAGES;

  const variantsJson = useMemo(() => {
    if (!hasVariants) return "";
    return JSON.stringify(
      variants
        .filter((v) => v.label.trim() !== "")
        .map((v) => ({
          id: v.id ?? undefined,
          label: v.label,
          attr_key: v.attr_key ?? "",
          attr_value: v.attr_value ?? "",
          seller_sku: v.seller_sku,
          price: v.price,
          moq: v.moq,
          stock_qty: v.stock_qty,
        })),
    );
  }, [hasVariants, variants]);

  const listedVariants = useMemo(
    () => (hasVariants ? variants.filter((v) => v.label.trim() !== "") : []),
    [hasVariants, variants],
  );

  function onImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const seen = new Set(newFiles.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
    const merged = [
      ...newFiles,
      ...picked.filter((f) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`)),
    ].slice(0, MAX_PRODUCT_IMAGES);
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    const urls = merged.map((f) => URL.createObjectURL(f));
    objectUrlsRef.current = urls;
    // Keep the file input in sync with the full staged set so the form POST
    // carries every chosen image, not just the latest pick.
    const dt = new DataTransfer();
    for (const f of merged) dt.items.add(f);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setPreviewUrls(urls);
    setNewFiles(merged);
  }

  function removeStaged(index: number) {
    const files = newFiles.filter((_, i) => i !== index);
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    const urls = files.map((f) => URL.createObjectURL(f));
    objectUrlsRef.current = urls;
    setPreviewUrls(urls);
    setNewFiles(files);
  }

  function updateVariant(index: number, patch: Partial<ExistingVariant>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function controlKey(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    return el.id || el.getAttribute("aria-label") || el.name;
  }

  function pinpoint(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
    setInvalidField({ id: controlKey(el), message: el.validationMessage });
    el.focus();
    el.scrollIntoView({ block: "center" });
  }

  function firstInvalidIn(root: Element | null): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
    const fields = root?.querySelectorAll("input, textarea, select") ?? [];
    for (const field of fields) {
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        if (!field.checkValidity()) return field;
      }
    }
    return null;
  }

  function invalidFor(id: string): boolean | undefined {
    return invalidField?.id === id ? true : undefined;
  }

  function errorFor(id: string): ReactNode {
    return invalidField?.id === id ? <FieldError>{invalidField.message}</FieldError> : null;
  }

  function clearInvalidForEvent(e: SyntheticEvent) {
    if (!invalidField) return;
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
      if (controlKey(t) === invalidField.id) setInvalidField(null);
    }
  }

  const grouped = useMemo(() => {
    const parents = categories.filter((c) => !c.parentName);
    return parents.map((p) => ({
      parent: p,
      children: categories.filter((c) => c.parentName === p.name),
    }));
  }, [categories]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          render={<Link href="/supplier/dashboard/products" />}
          nativeButton={false}
          variant="outline"
        >
          Cancel
        </Button>
      </div>

      <form
        ref={formRef}
        action={action}
        onChangeCapture={clearInvalidForEvent}
        onSubmit={(e) => {
          const form = formRef.current;
          // Second pass: our own code explicitly allowed this POST.
          if (allowSubmitRef.current) {
            allowSubmitRef.current = false;
            return;
          }
          // First pass: intercept EVERY submit — no POST leaves the browser
          // without passing explicit validation below.
          e.preventDefault();
          if (!form) return;
          const bad = firstInvalidIn(form);
          if (bad) {
            pinpoint(bad);
            return;
          }
          if (autoSubmitRef.current) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = "auto_submit";
            input.value = "1";
            form.appendChild(input);
          }
          // Explicitly allowed: re-submit programmatically so the POST goes
          // through the second pass above.
          allowSubmitRef.current = true;
          try {
            form.requestSubmit();
          } catch {
            allowSubmitRef.current = false;
          }
        }}
      >
        <input type="hidden" name="wizard_complete" value="1" />
        <input type="hidden" name="variants_json" value={variantsJson} />
        <div className="grid grid-cols-1 gap-4 @3xl/content:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-w-0 flex-col gap-4">
            <FormSection
              id="basic"
              title="Basic information"
              description="What buyers see first — make the title specific, like IndiaMART listings."
            >
              <FieldSet>
                <FieldLegend>Listing</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="title">Product title</FieldLabel>
                    <Input id="title" name="title" required minLength={10} maxLength={140} aria-invalid={invalidFor("title")} defaultValue={product?.title ?? ""} placeholder="Cotton school socks, ankle length" />
                    <FieldDescription>10–140 characters.</FieldDescription>
                    {errorFor("title")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="category_id">Subcategory</FieldLabel>
                    <NativeSelect id="category_id" name="category_id" required aria-invalid={invalidFor("category_id")} defaultValue={product?.category_id ?? ""}>
                      <NativeSelectOption value="" disabled>Pick a subcategory</NativeSelectOption>
                      {grouped.map((g) => (
                        <NativeSelectOptGroup key={g.parent.id} label={g.parent.name}>
                          {g.children.map((c) => (
                            <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>
                          ))}
                        </NativeSelectOptGroup>
                      ))}
                    </NativeSelect>
                    {errorFor("category_id")}
                  </Field>
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend>Identification</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="brand">Brand (optional)</FieldLabel>
                    <Input id="brand" name="brand" maxLength={60} defaultValue={product?.brand ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="seller_sku">Your SKU</FieldLabel>
                    <Input id="seller_sku" name="seller_sku" required pattern="[A-Za-z0-9-_]{3,30}" aria-invalid={invalidFor("seller_sku")} defaultValue={product?.seller_sku ?? ""} placeholder="SCK-ANK-001" />
                    <FieldDescription>Unique per product. Variants use their own SKUs.</FieldDescription>
                    {errorFor("seller_sku")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="hsn_code">HSN code</FieldLabel>
                    <Input id="hsn_code" name="hsn_code" required pattern="\d{4,8}" inputMode="numeric" aria-invalid={invalidFor("hsn_code")} defaultValue={product?.hsn_code ?? ""} placeholder="6115" />
                    <FieldDescription>4–8 digits, as printed on your GST invoice.</FieldDescription>
                    {errorFor("hsn_code")}
                  </Field>
                </FieldGroup>
              </FieldSet>
              <FieldSet className="grid gap-4 col-span-full">
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea id="description" name="description" required minLength={50} rows={6} aria-invalid={invalidFor("description")} defaultValue={product?.description ?? ""} placeholder="Material, sizes, packaging, certifications…" />
                  <FieldDescription>At least 50 characters — material, sizes, packaging, certifications.</FieldDescription>
                  {errorFor("description")}
                </Field>
              </FieldSet>
            </FormSection>

            <FormSection
              id="pricing"
              title="Pricing"
              description="Base price plus GST applies to the whole listing unless variants override it."
            >
              <FieldSet>
                <FieldLegend>Price</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="unit">Selling unit</FieldLabel>
                    <NativeSelect id="unit" name="unit" required aria-invalid={invalidFor("unit")} defaultValue={product?.unit ?? "pcs"}>
                      {PRODUCT_UNITS.map((u) => (
                        <NativeSelectOption key={u} value={u}>{u}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {errorFor("unit")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="price_per_unit">Base price (₹ per unit)</FieldLabel>
                    <Input id="price_per_unit" name="price_per_unit" required type="number" min={0.01} step="0.01" aria-invalid={invalidFor("price_per_unit")} defaultValue={product?.price_per_unit ?? ""} />
                    <FieldDescription>Variants can override this with their own absolute price.</FieldDescription>
                    {errorFor("price_per_unit")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="gst_rate">GST rate (%)</FieldLabel>
                    <NativeSelect id="gst_rate" name="gst_rate" required aria-invalid={invalidFor("gst_rate")} defaultValue={product?.gst_rate != null ? String(product.gst_rate) : ""}>
                      <NativeSelectOption value="" disabled>Select rate</NativeSelectOption>
                      {PRODUCT_GST_RATES.map((r) => (
                        <NativeSelectOption key={r} value={String(r)}>{r}%</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    {errorFor("gst_rate")}
                  </Field>
                  <Field orientation="horizontal">
                    <Switch id="negotiable-switch" checked={negotiable} onCheckedChange={setNegotiable} />
                    <FieldLabel htmlFor="negotiable-switch">Price negotiable</FieldLabel>
                    <input type="hidden" name="negotiable" value={negotiable ? "1" : ""} />
                  </Field>
                </FieldGroup>
              </FieldSet>
              <FieldSet>
                <FieldLegend>Inventory and fulfilment</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="moq">Minimum order quantity</FieldLabel>
                    <Input id="moq" name="moq" required type="number" min={1} step="1" aria-invalid={invalidFor("moq")} defaultValue={product?.moq ?? ""} />
                    <FieldDescription>MOQ filters out irrelevant enquiries.</FieldDescription>
                    {errorFor("moq")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="stock_qty">Stock on hand</FieldLabel>
                    <Input id="stock_qty" name="stock_qty" type="number" min={0} step="1" aria-invalid={invalidFor("stock_qty")} defaultValue={product?.stock_qty ?? 0} />
                    {errorFor("stock_qty")}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lead_time_days">Lead time (days)</FieldLabel>
                    <Input id="lead_time_days" name="lead_time_days" required type="number" min={1} max={90} step="1" aria-invalid={invalidFor("lead_time_days")} defaultValue={product?.lead_time_days ?? ""} placeholder="15" />
                    {errorFor("lead_time_days")}
                  </Field>
                  <Field orientation="horizontal">
                    <Switch id="sample-switch" checked={sampleAvailable} onCheckedChange={setSampleAvailable} />
                    <FieldLabel htmlFor="sample-switch">Offer sample</FieldLabel>
                    <input type="hidden" name="sample_available" value={sampleAvailable ? "1" : ""} />
                  </Field>
                  {sampleAvailable ? (
                    <Field>
                      <FieldLabel htmlFor="sample_price">Sample price (₹)</FieldLabel>
                      <Input id="sample_price" name="sample_price" type="number" min={0.01} step="0.01" aria-invalid={invalidFor("sample_price")} defaultValue={product?.sample_price ?? ""} />
                      {errorFor("sample_price")}
                    </Field>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            </FormSection>

            <FormSection
              id="photos"
              title="Photos"
              description="JPG, PNG or WEBP, under 2 MB each. Add 3–8 images — the first image is the cover."
              columns={1}
            >
              <Field>
                <FieldLabel htmlFor="images">Product images</FieldLabel>
                <input ref={fileInputRef} id="images" name="images" type="file" accept=".jpg,.jpeg,.png,.webp" multiple hidden onChange={onImagesChange} />
                {totalImages === 0 ? (
                  <FieldDescription>
                    No images yet — add at least 3 clear photos before submitting for approval.
                  </FieldDescription>
                ) : (
                  <FieldDescription>
                    {totalImages} of {MAX_PRODUCT_IMAGES} images
                    {totalImages < 3 ? ` — add at least ${3 - totalImages} more` : null}
                  </FieldDescription>
                )}
              </Field>
              <AttachmentGroup>
                {existingImages.map((img, i) => (
                  <Attachment key={img.id} orientation="vertical" state="done">
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
                {newFiles.map((file, i) => (
                  <Attachment key={`${file.name}-${i}`} orientation="vertical" state="done">
                    <AttachmentActions>
                      <AttachmentAction
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeStaged(i)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                      </AttachmentAction>
                    </AttachmentActions>
                    <AttachmentMedia variant="image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrls[i]} alt={`New upload ${i + 1}`} />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>
                        {existingImages.length + i === 0 ? "Cover" : `Image ${existingImages.length + i + 1}`}
                      </AttachmentTitle>
                      <AttachmentDescription>
                        {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
                      </AttachmentDescription>
                    </AttachmentContent>
                  </Attachment>
                ))}
                {canAddMore ? (
                  <Attachment orientation="vertical" state="idle">
                    <AttachmentMedia>
                      <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>Add images</AttachmentTitle>
                      <AttachmentDescription>{MAX_PRODUCT_IMAGES - totalImages} slots left</AttachmentDescription>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction type="button" aria-label="Add images" onClick={() => fileInputRef.current?.click()}>
                        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                ) : null}
              </AttachmentGroup>
            </FormSection>

            <FormSection
              id="video-variants"
              title="Video and variants"
              description="A YouTube walkthrough and size/pack/colour variants are optional but convert better."
            >
              <FieldSet>
                <FieldLegend>Video (optional)</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="youtube_url">YouTube link</FieldLabel>
                    <Input id="youtube_url" name="youtube_url" type="url" maxLength={200} aria-invalid={invalidFor("youtube_url")} value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
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
              <FieldSet>
                <FieldLegend>Variants</FieldLegend>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Switch id="variants-switch" checked={hasVariants} onCheckedChange={(v) => { setHasVariants(v); if (v && variants.length === 0) setVariants([newVariant()]); }} />
                    <FieldLabel htmlFor="variants-switch">Size, pack, colour variants</FieldLabel>
                  </Field>
                  {hasVariants ? (
                    <Field>
                      <FieldDescription>Each variant has its own absolute price, SKU, MOQ and stock. Empty MOQ uses the base MOQ.</FieldDescription>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Label</TableHead>
                            <TableHead>Attribute</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Price ₹</TableHead>
                            <TableHead>MOQ</TableHead>
                            <TableHead>Stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {variants.map((v, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Input id={`variant-${i}-label`} aria-label={`Variant ${i + 1} label`} required={hasVariants} aria-invalid={invalidFor(`variant-${i}-label`)} value={v.label} onChange={(e) => updateVariant(i, { label: e.target.value })} placeholder="500ml – Pack of 12" />
                              </TableCell>
                              <TableCell>
                                <Input id={`variant-${i}-attr`} aria-label={`Variant ${i + 1} attribute`} value={`${v.attr_key ?? ""}${v.attr_value ? `: ${v.attr_value}` : ""}`} onChange={(e) => {
                                  const [k, ...rest] = e.target.value.split(":");
                                  updateVariant(i, { attr_key: (k ?? "").trim(), attr_value: rest.join(":").trim() });
                                }} placeholder="size: 500ml" />
                              </TableCell>
                              <TableCell>
                                <Input id={`variant-${i}-sku`} aria-label={`Variant ${i + 1} SKU`} required={hasVariants} pattern="[A-Za-z0-9-_]{3,30}" aria-invalid={invalidFor(`variant-${i}-sku`)} value={v.seller_sku} onChange={(e) => updateVariant(i, { seller_sku: e.target.value })} />
                              </TableCell>
                              <TableCell>
                                <Input id={`variant-${i}-price`} aria-label={`Variant ${i + 1} price`} required={hasVariants} type="number" min={0.01} step="0.01" aria-invalid={invalidFor(`variant-${i}-price`)} value={v.price || ""} onChange={(e) => updateVariant(i, { price: Number(e.target.value) })} />
                              </TableCell>
                              <TableCell>
                                <Input id={`variant-${i}-moq`} aria-label={`Variant ${i + 1} MOQ`} type="number" min={1} step="1" aria-invalid={invalidFor(`variant-${i}-moq`)} value={v.moq ?? ""} onChange={(e) => updateVariant(i, { moq: e.target.value === "" ? null : Number(e.target.value) })} placeholder="base" />
                              </TableCell>
                              <TableCell>
                                <Input id={`variant-${i}-stock`} aria-label={`Variant ${i + 1} stock`} type="number" min={0} step="1" aria-invalid={invalidFor(`variant-${i}-stock`)} value={v.stock_qty} onChange={(e) => updateVariant(i, { stock_qty: Number(e.target.value) })} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {invalidField?.id.startsWith("variant-") ? (
                        <FieldError>{invalidField.message}</FieldError>
                      ) : null}
                      <ButtonGroup>
                        <Button type="button" variant="outline" onClick={() => setVariants((p) => (p.length >= 20 ? p : [...p, newVariant()]))}>Add variant</Button>
                        {variants.length > 1 ? (
                          <Button type="button" variant="ghost" onClick={() => setVariants((p) => p.slice(0, -1))}>Remove last</Button>
                        ) : null}
                      </ButtonGroup>
                    </Field>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            </FormSection>

            <FormSection
              id="shipping"
              title="Packaging and shipping"
              description="Optional details buyers appreciate before ordering."
              columns={1}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="packaging_details">Packaging details (optional)</FieldLabel>
                  <Textarea id="packaging_details" name="packaging_details" rows={3} defaultValue={product?.packaging_details ?? ""} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="warranty_return">Warranty and returns (optional)</FieldLabel>
                  <Textarea id="warranty_return" name="warranty_return" rows={3} defaultValue={product?.warranty_return ?? ""} />
                </Field>
              </FieldGroup>
            </FormSection>
          </div>

          <aside className="flex h-fit flex-col gap-4 @3xl/content:sticky @3xl/content:top-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium">Listing summary</p>
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Photos</span>
                    <span className={totalImages >= 3 ? "font-medium text-success" : "font-medium"}>
                      {totalImages} / {MAX_PRODUCT_IMAGES}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${totalImages >= 3 ? "bg-success" : "bg-foreground/20"}`}
                      style={{ width: `${Math.min(100, (totalImages / MAX_PRODUCT_IMAGES) * 100)}%` }}
                    />
                  </div>
                  {totalImages < 3 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add {3 - totalImages} more to submit.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Variants</span>
                  <span className="font-medium">{listedVariants.length}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {mode === "create"
                  ? "Drafts are private until you submit. Submissions go to moderation."
                  : "Only draft or returned products can be edited here."}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  autoSubmitRef.current = true;
                  formRef.current?.requestSubmit();
                }}
              >
                {pending ? "Saving…" : "Save and submit for approval"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  autoSubmitRef.current = false;
                  formRef.current?.requestSubmit();
                }}
              >
                Save draft
              </Button>
            </div>
            {state.message ? (
              <Alert variant={state.ok ? "default" : "destructive"}>
                <AlertTitle>{state.ok ? "Saved" : "Check the form"}</AlertTitle>
                <AlertDescription>
                  {state.message}
                  {state.ok ? (
                    <>
                      {" "}
                      <Link href="/supplier/dashboard/products" className="underline underline-offset-4 hover:text-primary">
                        View products
                      </Link>
                    </>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </aside>
        </div>
      </form>
    </div>
  );
}