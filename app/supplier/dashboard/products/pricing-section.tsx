import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { FormSection } from "@/components/dashboard/form-section";
import { PRODUCT_UNITS } from "@/lib/supplier/products";
import type { FieldErrorHelpers } from "./product-form-types";

export function PricingSection({
  invalidFor,
  errorFor,
  formValues,
  onValueChange,
  negotiable,
  onNegotiableChange,
}: {
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
  formValues: Map<string, string>;
  onValueChange: (key: string, value: string) => void;
  negotiable: boolean;
  onNegotiableChange: (value: boolean) => void;
}) {
  const v = (key: string): string => formValues.get(key) ?? "";

  return (
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
            <NativeSelect id="unit" name="unit" required aria-invalid={invalidFor("unit")} value={v("unit") || "pcs"} onChange={(e) => onValueChange("unit", e.target.value)}>
              {PRODUCT_UNITS.map((u) => (
                <NativeSelectOption key={u} value={u}>{u}</NativeSelectOption>
              ))}
            </NativeSelect>
            {errorFor("unit")}
          </Field>
          <Field>
            <FieldLabel htmlFor="price_per_unit">Base price (₹ per unit)</FieldLabel>
            <Input id="price_per_unit" name="price_per_unit" required type="number" min={0.01} step="0.01" aria-invalid={invalidFor("price_per_unit")} value={v("price_per_unit")} onChange={(e) => onValueChange("price_per_unit", e.target.value)} />
            <FieldDescription>Variants can override this with their own absolute price.</FieldDescription>
            {errorFor("price_per_unit")}
          </Field>
          <Field orientation="horizontal">
            <Switch id="negotiable-switch" checked={negotiable} onCheckedChange={onNegotiableChange} />
            <FieldLabel htmlFor="negotiable-switch">Price negotiable</FieldLabel>
            <input type="hidden" name="negotiable" value={negotiable ? "1" : ""} />
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Order quantity</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="moq">Minimum order quantity</FieldLabel>
            <Input id="moq" name="moq" required type="number" min={1} step="1" aria-invalid={invalidFor("moq")} value={v("moq")} onChange={(e) => onValueChange("moq", e.target.value)} />
            <FieldDescription>MOQ filters out irrelevant enquiries.</FieldDescription>
            {errorFor("moq")}
          </Field>
        </FieldGroup>
      </FieldSet>
    </FormSection>
  );
}