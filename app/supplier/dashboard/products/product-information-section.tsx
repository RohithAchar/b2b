import { useState } from "react";
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
} from "@/components/ui/native-select";
import { FormSection } from "@/components/dashboard/form-section";
import { cn } from "cn";
import dynamic from "next/dynamic";
import {
  DESCRIPTION_MIN_TEXT_CHARS,
  plainTextLength,
} from "@/lib/supplier/rich-text";
import { PRODUCT_GST_RATES, PRODUCT_UNITS } from "@/lib/supplier/products";
import type { CategoryOption, FieldErrorHelpers } from "./product-form-types";

const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false },
);

export function ProductInformationSection({
  categories,
  invalidFor,
  errorFor,
  formValues,
  onValueChange,
  skuDuplicate,
}: {
  categories: CategoryOption[];
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
  formValues: Map<string, string>;
  onValueChange: (key: string, value: string) => void;
  skuDuplicate?: boolean | null;
}) {
  const v = (key: string): string => formValues.get(key) ?? "";
  const descriptionLength = plainTextLength(v("description"));

  const [touched, setTouched] = useState<Set<string>>(new Set());
  const touch = (id: string) =>
    setTouched((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const title = v("title").trim();
  const titleError =
    title === ""
      ? touched.has("title")
        ? "Required."
        : null
      : title.length < 10
        ? "Title needs at least 10 characters."
        : null;

  const category = v("category_id").trim();
  const categoryError =
    category === "" ? (touched.has("category_id") ? "Required." : null) : null;

  const sku = v("seller_sku").trim();
  const skuError =
    sku === ""
      ? touched.has("seller_sku")
        ? "Required."
        : null
      : !/^[A-Za-z0-9-_]{3,30}$/i.test(sku)
        ? "SKU: 3–30 chars, letters/numbers/-/_ ."
        : null;

  const hsn = v("hsn_code").trim();
  const hsnError =
    hsn === ""
      ? touched.has("hsn_code")
        ? "Required."
        : null
      : !/^\d{4,8}$/.test(hsn)
        ? "HSN must be 4–8 digits."
        : null;

  const gst = v("gst_rate").trim();
  const gstError =
    gst === "" ? (touched.has("gst_rate") ? "Required." : null) : null;

  const unit = v("unit").trim() || "pcs";
  const unitError = !["pcs", "kg", "box", "mtr", "ltr"].includes(unit)
    ? "Pick a valid unit."
    : null;

  const priceRaw = v("price_per_unit").trim();
  const price = Number(priceRaw);
  const priceError =
    priceRaw === ""
      ? touched.has("price_per_unit")
        ? "Required."
        : null
      : !Number.isFinite(price) || price <= 0
        ? "Price must be positive."
        : null;

  const descError =
    descriptionLength === 0
      ? touched.has("description")
        ? "Required."
        : null
      : descriptionLength < DESCRIPTION_MIN_TEXT_CHARS
        ? `Description needs at least ${DESCRIPTION_MIN_TEXT_CHARS} characters of text.`
        : null;

  return (
    <FormSection
      id="product-information"
      title="Product information"
      description="What buyers see first — make the title specific, like IndiaMART listings."
    >
      <FieldSet>
        <FieldLegend>Listing</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="title">Product title <span className="text-destructive">*</span></FieldLabel>
            <Input id="title" name="title" required minLength={10} maxLength={140} aria-invalid={invalidFor("title") || !!titleError} value={v("title")} onChange={(e) => onValueChange("title", e.target.value)} onBlur={() => touch("title")} placeholder="Cotton school socks, ankle length" />
            <FieldDescription>10–140 characters.</FieldDescription>
            {titleError ? <FieldError>{titleError}</FieldError> : errorFor("title")}
          </Field>
          <Field>
            <FieldLabel htmlFor="category_id">Category <span className="text-destructive">*</span></FieldLabel>
            <NativeSelect id="category_id" name="category_id" required aria-invalid={invalidFor("category_id") || !!categoryError} value={v("category_id")} onChange={(e) => onValueChange("category_id", e.target.value)} onBlur={() => touch("category_id")}>
              <NativeSelectOption value="" disabled>Pick a category</NativeSelectOption>
              {categories.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>{c.name}</NativeSelectOption>
              ))}
            </NativeSelect>
            {categoryError ? <FieldError>{categoryError}</FieldError> : errorFor("category_id")}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Identification</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="seller_sku">Your SKU <span className="text-destructive">*</span></FieldLabel>
            <Input id="seller_sku" name="seller_sku" required aria-invalid={invalidFor("seller_sku") || !!skuError} value={v("seller_sku")} onChange={(e) => onValueChange("seller_sku", e.target.value)} onBlur={() => touch("seller_sku")} placeholder="SCK-ANK-001" />
            <FieldDescription>Unique per product. Variants use their own SKUs.</FieldDescription>
            {skuDuplicate === true ? (
              <p className="text-sm text-destructive">This SKU is already used by another product.</p>
            ) : null}
            {skuDuplicate === false && v("seller_sku").trim() !== "" ? (
              <p className="text-sm text-success">SKU is available.</p>
            ) : null}
            {skuError ? <FieldError>{skuError}</FieldError> : errorFor("seller_sku")}
          </Field>
          <FieldGroup className="grid gap-7 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="hsn_code">HSN code <span className="text-destructive">*</span></FieldLabel>
              <Input id="hsn_code" name="hsn_code" required pattern="\d{4,8}" inputMode="numeric" aria-invalid={invalidFor("hsn_code") || !!hsnError} value={v("hsn_code")} onChange={(e) => onValueChange("hsn_code", e.target.value)} onBlur={() => touch("hsn_code")} placeholder="6115" />
              <FieldDescription>4–8 digits, as printed on your GST invoice.</FieldDescription>
              {hsnError ? <FieldError>{hsnError}</FieldError> : errorFor("hsn_code")}
            </Field>
            <Field>
              <FieldLabel htmlFor="gst_rate">GST rate (%) <span className="text-destructive">*</span></FieldLabel>
              <NativeSelect id="gst_rate" name="gst_rate" required aria-invalid={invalidFor("gst_rate") || !!gstError} value={v("gst_rate")} onChange={(e) => onValueChange("gst_rate", e.target.value)} onBlur={() => touch("gst_rate")}>
                <NativeSelectOption value="" disabled>Select rate</NativeSelectOption>
                {PRODUCT_GST_RATES.map((r) => (
                  <NativeSelectOption key={r} value={String(r)}>{r}%</NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>Applied on top of the base price.</FieldDescription>
              {gstError ? <FieldError>{gstError}</FieldError> : errorFor("gst_rate")}
            </Field>
          </FieldGroup>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Pricing</FieldLegend>
        <FieldGroup className="grid gap-7 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="unit">Selling unit <span className="text-destructive">*</span></FieldLabel>
            <NativeSelect id="unit" name="unit" required aria-invalid={invalidFor("unit") || !!unitError} value={v("unit") || "pcs"} onChange={(e) => onValueChange("unit", e.target.value)} onBlur={() => touch("unit")}>
              {PRODUCT_UNITS.map((u) => (
                <NativeSelectOption key={u} value={u}>{u}</NativeSelectOption>
              ))}
            </NativeSelect>
            {unitError ? <FieldError>{unitError}</FieldError> : errorFor("unit")}
          </Field>
          <Field>
            <FieldLabel htmlFor="price_per_unit">Base price per unit <span className="text-destructive">*</span></FieldLabel>
            <Input id="price_per_unit" name="price_per_unit" required type="number" min={0.01} step="0.01" aria-invalid={invalidFor("price_per_unit") || !!priceError} value={v("price_per_unit")} onChange={(e) => onValueChange("price_per_unit", e.target.value)} onBlur={() => touch("price_per_unit")} placeholder="100" />
            {priceError ? <FieldError>{priceError}</FieldError> : errorFor("price_per_unit")}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Packaging &amp; dispatch</FieldLegend>
        <FieldGroup className="grid gap-7 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="carton_units">Units per carton</FieldLabel>
            <Input id="carton_units" name="carton_units" type="number" min={1} step="1" aria-invalid={invalidFor("carton_units")} value={v("carton_units")} onChange={(e) => onValueChange("carton_units", e.target.value)} placeholder="24" />
            {errorFor("carton_units")}
          </Field>
          <Field>
            <FieldLabel htmlFor="carton_weight_kg">Carton weight (kg)</FieldLabel>
            <Input id="carton_weight_kg" name="carton_weight_kg" type="number" min={0.001} step="0.001" aria-invalid={invalidFor("carton_weight_kg")} value={v("carton_weight_kg")} onChange={(e) => onValueChange("carton_weight_kg", e.target.value)} placeholder="12.5" />
            {errorFor("carton_weight_kg")}
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="carton_dimensions">Carton dimensions</FieldLabel>
            <Input id="carton_dimensions" name="carton_dimensions" maxLength={100} aria-invalid={invalidFor("carton_dimensions")} value={v("carton_dimensions")} onChange={(e) => onValueChange("carton_dimensions", e.target.value)} placeholder="40 × 30 × 25 cm" />
            <FieldDescription>Optional — length × width × height.</FieldDescription>
            {errorFor("carton_dimensions")}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet className="col-span-full grid gap-4">
        <Field>
          <FieldLabel htmlFor="description">Description <span className="text-destructive">*</span></FieldLabel>
          <input type="hidden" name="description" value={v("description")} />
          <RichTextEditor
            id="description"
            value={v("description")}
            onChange={(html) => onValueChange("description", html)}
            invalid={invalidFor("description")}
            placeholder="Describe your product — material, sizes, packaging, certifications…"
          />
          <FieldDescription>
            At least {DESCRIPTION_MIN_TEXT_CHARS} characters of text — material, sizes, packaging, certifications.
          </FieldDescription>
          <p className={cn("text-xs tabular-nums", descriptionLength >= DESCRIPTION_MIN_TEXT_CHARS ? "text-success" : "text-muted-foreground")}>
            {descriptionLength} / {DESCRIPTION_MIN_TEXT_CHARS} characters of text
          </p>
          {descError ? <FieldError>{descError}</FieldError> : errorFor("description")}
        </Field>
      </FieldSet>
    </FormSection>
  );
}