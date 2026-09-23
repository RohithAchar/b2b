import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { FormSection } from "@/components/dashboard/form-section";
import { cn } from "cn";
import {
  DESCRIPTION_MIN_TEXT_CHARS,
  plainTextLength,
} from "@/lib/supplier/rich-text";
import { RichTextEditor } from "./rich-text-editor";
import type { CategoryGroup, FieldErrorHelpers } from "./product-form-types";

export function ProductInformationSection({
  grouped,
  invalidFor,
  errorFor,
  formValues,
  onValueChange,
}: {
  grouped: CategoryGroup[];
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
  formValues: Map<string, string>;
  onValueChange: (key: string, value: string) => void;
}) {
  const v = (key: string): string => formValues.get(key) ?? "";
  const descriptionLength = plainTextLength(v("description"));

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
            <FieldLabel htmlFor="title">Product title</FieldLabel>
            <Input id="title" name="title" required minLength={10} maxLength={140} aria-invalid={invalidFor("title")} value={v("title")} onChange={(e) => onValueChange("title", e.target.value)} placeholder="Cotton school socks, ankle length" />
            <FieldDescription>10–140 characters.</FieldDescription>
            {errorFor("title")}
          </Field>
          <Field>
            <FieldLabel htmlFor="category_id">Subcategory</FieldLabel>
            <NativeSelect id="category_id" name="category_id" required aria-invalid={invalidFor("category_id")} value={v("category_id")} onChange={(e) => onValueChange("category_id", e.target.value)}>
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
            <Input id="brand" name="brand" maxLength={60} value={v("brand")} onChange={(e) => onValueChange("brand", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="seller_sku">Your SKU</FieldLabel>
            <Input id="seller_sku" name="seller_sku" required pattern="[A-Za-z0-9-_]{3,30}" aria-invalid={invalidFor("seller_sku")} value={v("seller_sku")} onChange={(e) => onValueChange("seller_sku", e.target.value)} placeholder="SCK-ANK-001" />
            <FieldDescription>Unique per product. Variants use their own SKUs.</FieldDescription>
            {errorFor("seller_sku")}
          </Field>
          <Field>
            <FieldLabel htmlFor="hsn_code">HSN code</FieldLabel>
            <Input id="hsn_code" name="hsn_code" required pattern="\d{4,8}" inputMode="numeric" aria-invalid={invalidFor("hsn_code")} value={v("hsn_code")} onChange={(e) => onValueChange("hsn_code", e.target.value)} placeholder="6115" />
            <FieldDescription>4–8 digits, as printed on your GST invoice.</FieldDescription>
            {errorFor("hsn_code")}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet className="col-span-full grid gap-4">
        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
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
          {errorFor("description")}
        </Field>
      </FieldSet>
    </FormSection>
  );
}