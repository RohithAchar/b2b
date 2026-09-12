"use client";

import { useActionState, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Image01Icon,
  Tick01Icon,
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
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
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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

const STEPS = ["Basics", "Price and stock", "Media and variants", "Review"] as const;

const initialState: ProductActionState = { ok: false, message: "" };

type ReviewSnapshot = {
  title: string;
  category: string;
  brand: string;
  seller_sku: string;
  hsn_code: string;
  description: string;
  unit: string;
  price_per_unit: string;
  moq: string;
  stock_qty: string;
  lead_time_days: string;
  gst_rate: string;
  negotiable: boolean;
  sample_available: boolean;
  sample_price: string;
};

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

function categoryDisplay(categories: CategoryOption[], id: string): string {
  const found = categories.find((c) => c.id === id);
  if (!found) return "—";
  return found.parentName ? `${found.parentName} / ${found.name}` : found.name;
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
  const [step, setStep] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<{ id: string; message: string } | null>(null);
  const [summary, setSummary] = useState<ReviewSnapshot | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Submission gate: the browser never POSTs unless our own code sets this
  // flag after explicit validation. Any stray submit (wrong button type,
  // Enter key, extension) is intercepted below and routed to validation.
  const allowSubmitRef = useRef(false);

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

  function snapshotReview(form: HTMLFormElement): ReviewSnapshot {
    const get = (name: string) => {
      const el = form.elements.namedItem(name);
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
        ? el.value
        : "";
    };
    return {
      title: get("title"),
      category: categoryDisplay(categories, get("category_id")),
      brand: get("brand"),
      seller_sku: get("seller_sku"),
      hsn_code: get("hsn_code"),
      description: get("description"),
      unit: get("unit"),
      price_per_unit: get("price_per_unit"),
      moq: get("moq"),
      stock_qty: get("stock_qty"),
      lead_time_days: get("lead_time_days"),
      gst_rate: get("gst_rate"),
      negotiable,
      sample_available: sampleAvailable,
      sample_price: get("sample_price"),
    };
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

  function firstInvalidAcross(form: HTMLFormElement): { step: number; el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement } | null {
    for (let s = 0; s < STEPS.length - 1; s += 1) {
      const bad = firstInvalidIn(form.querySelector(`[data-step="${s}"]`));
      if (bad) return { step: s, el: bad };
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

  function goNext() {
    const form = formRef.current;
    if (!form) return;
    allowSubmitRef.current = false;
    const bad = firstInvalidIn(form.querySelector(`[data-step="${step}"]`));
    if (bad) {
      pinpoint(bad);
      return;
    }
    const next = Math.min(step + 1, STEPS.length - 1);
    if (next === STEPS.length - 1) setSummary(snapshotReview(form));
    setInvalidField(null);
    setFieldError(null);
    setStep(next);
  }

  function goBack() {
    allowSubmitRef.current = false;
    setInvalidField(null);
    setFieldError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  const grouped = useMemo(() => {
    const parents = categories.filter((c) => !c.parentName);
    return parents.map((p) => ({
      parent: p,
      children: categories.filter((c) => c.parentName === p.name),
    }));
  }, [categories]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={String(step)}
          onValueChange={(v) => setStep(Number(v))}
        >
          <TabsList variant="line">
            {STEPS.map((label, i) => (
              <TabsTrigger key={label} value={String(i)}>
                {i < step ? (
                  <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} />
                ) : null}
                {i + 1}. {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Separator />
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
            // First pass: intercept EVERY submit — no POST leaves the
            // browser without passing explicit validation below.
            e.preventDefault();
            if (!form) return;
            if (step !== STEPS.length - 1) {
              goNext();
              return;
            }
            // Review step: backstop — jump to the offending step and
            // pinpoint it instead of posting with hidden invalid fields.
            const offender = firstInvalidAcross(form);
            if (offender) {
              const id = controlKey(offender.el);
              const message = offender.el.validationMessage;
              setStep(offender.step);
              window.setTimeout(() => {
                const fields = form.querySelectorAll("input, textarea, select");
                for (const field of fields) {
                  if (
                    (field instanceof HTMLInputElement ||
                      field instanceof HTMLTextAreaElement ||
                      field instanceof HTMLSelectElement) &&
                    controlKey(field) === id
                  ) {
                    pinpoint(field);
                    return;
                  }
                }
                setInvalidField({ id, message });
              }, 60);
              return;
            }
            // Explicitly allowed: re-submit programmatically so the POST
            // goes through the second pass above.
            allowSubmitRef.current = true;
            try {
              form.requestSubmit();
            } catch {
              allowSubmitRef.current = false;
            }
          }}
        >
          <FieldSet>
            <FieldLegend>
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </FieldLegend>
            <FieldGroup>
              <section data-step={0} hidden={step !== 0}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="title">Product title</FieldLabel>
                    <Input id="title" name="title" required minLength={10} maxLength={140} aria-invalid={invalidFor("title")} defaultValue={product?.title ?? ""} placeholder="Cotton school socks, ankle length" />
                    <FieldDescription>10–140 characters, like Alibaba and IndiaMART listings.</FieldDescription>
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
                  <Field>
                    <FieldLabel htmlFor="brand">Brand (optional)</FieldLabel>
                    <Input id="brand" name="brand" maxLength={60} defaultValue={product?.brand ?? ""} />
                  </Field>
                  <FieldSet>
                    <FieldLegend>Product identification</FieldLegend>
                    <FieldGroup>
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
                  <Field>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea id="description" name="description" required minLength={50} rows={6} aria-invalid={invalidFor("description")} defaultValue={product?.description ?? ""} placeholder="Material, sizes, packaging, certifications…" />
                    <FieldDescription>At least 50 characters — material, sizes, packaging, certifications.</FieldDescription>
                    {errorFor("description")}
                    {fieldError ? <FieldError>{fieldError}</FieldError> : null}
                  </Field>
                </FieldGroup>
              </section>
              <section data-step={1} hidden={step !== 1}>
                <FieldGroup>
                  <FieldSet>
                    <FieldLegend>Pricing</FieldLegend>
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
                </FieldGroup>
              </section>
              <section data-step={2} hidden={step !== 2}>
                <FieldGroup>
                  <FieldSet>
                    <FieldLegend>Photos</FieldLegend>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="images">Product images</FieldLabel>
                        <input ref={fileInputRef} id="images" name="images" type="file" accept=".jpg,.jpeg,.png,.webp" multiple hidden onChange={onImagesChange} />
                        <FieldDescription>JPG, PNG or WEBP, under 2 MB each. Add {MIN_IMAGES_LABEL} — the first image is the cover.</FieldDescription>
                      </Field>
                      {totalImages === 0 ? (
                        <Empty>
                          <EmptyTitle>No images yet</EmptyTitle>
                          <EmptyDescription>Add at least 3 clear photos before submitting for approval.</EmptyDescription>
                        </Empty>
                      ) : (
                        <Field>
                          <FieldLabel>
                            {totalImages} of {MAX_PRODUCT_IMAGES} images
                            {totalImages < MIN_IMAGE_COUNT ? ` — add at least ${MIN_IMAGE_COUNT - totalImages} more` : null}
                          </FieldLabel>
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
                        </Field>
                      )}
                    </FieldGroup>
                  </FieldSet>
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
                          <input type="hidden" name="variants_json" value={variantsJson} />
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
                  <Field>
                    <FieldLabel htmlFor="packaging_details">Packaging details (optional)</FieldLabel>
                    <Textarea id="packaging_details" name="packaging_details" rows={3} defaultValue={product?.packaging_details ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="warranty_return">Warranty and returns (optional)</FieldLabel>
                    <Textarea id="warranty_return" name="warranty_return" rows={3} defaultValue={product?.warranty_return ?? ""} />
                  </Field>
                </FieldGroup>
              </section>
              <section data-step={3} hidden={step !== 3}>
                <FieldGroup>
                  {step === STEPS.length - 1 ? (
                    <input type="hidden" name="wizard_complete" value="1" />
                  ) : null}
                  <Field>
                    <FieldLabel>Review before saving</FieldLabel>
                    <FieldDescription>Saving stores a draft. You then send it for approval from the product list.</FieldDescription>
                  </Field>
                  {summary ? (
                    <ItemGroup>
                      <Item variant="outline">
                        <ItemContent>
                          <ItemTitle>{summary.title || "—"}</ItemTitle>
                          <ItemDescription>{summary.category}</ItemDescription>
                          <ItemDescription>
                            SKU {summary.seller_sku || "—"} · HSN {summary.hsn_code || "—"}
                            {summary.brand ? ` · ${summary.brand}` : ""}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                      <Item variant="outline">
                        <ItemContent>
                          <ItemTitle>₹{summary.price_per_unit || "—"} / {summary.unit || "—"}</ItemTitle>
                          <ItemDescription>
                            MOQ {summary.moq || "—"} · Stock {summary.stock_qty || "0"} · Lead {summary.lead_time_days || "—"} days · GST {summary.gst_rate || "—"}%
                          </ItemDescription>
                          <ItemDescription>
                            {summary.negotiable ? "Negotiable" : "Fixed price"}
                            {summary.sample_available ? ` · Sample${summary.sample_price ? ` ₹${summary.sample_price}` : ""}` : ""}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                      <Item variant="outline">
                        <ItemContent>
                          <ItemTitle>
                            {totalImages} photo{totalImages === 1 ? "" : "s"}
                            {listedVariants.length > 0 ? ` · ${listedVariants.length} variant${listedVariants.length === 1 ? "" : "s"}` : ""}
                            {youtubeId ? " · Video attached" : ""}
                          </ItemTitle>
                          <ItemDescription>
                            {listedVariants.length > 0
                              ? listedVariants.map((v) => `${v.label} ₹${v.price}`).join(" · ")
                              : "No variants — single base price applies."}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    </ItemGroup>
                  ) : null}
                  {state.message ? (
                    <Alert variant={state.ok ? "default" : "destructive"}>
                      <AlertTitle>{state.ok ? "Saved" : "Check the form"}</AlertTitle>
                      <AlertDescription>{state.message}</AlertDescription>
                    </Alert>
                  ) : null}
                </FieldGroup>
              </section>
            </FieldGroup>
          </FieldSet>
          <Separator />
          <ButtonGroup>
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={goBack}>Back</Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext}>Continue to {STEPS[step + 1]}</Button>
            ) : (
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Save draft" : "Save changes"}</Button>
            )}
          </ButtonGroup>
        </form>
      </CardContent>
    </Card>
    </div>
  );
}

const MIN_IMAGES_LABEL = "3–8 images";
const MIN_IMAGE_COUNT = 3;
