import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/dashboard/form-section";
import { PRODUCT_GST_RATES } from "@/lib/supplier/products";
import type { FieldErrorHelpers } from "./product-form-types";

export function ShippingTaxSection({
  invalidFor,
  errorFor,
  formValues,
  onValueChange,
  columns = 1,
}: {
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
  formValues: Map<string, string>;
  onValueChange: (key: string, value: string) => void;
  columns?: 1 | 2;
}) {
  const v = (key: string): string => formValues.get(key) ?? "";

  return (
    <FormSection
      id="shipping-tax"
      title="Shipping & tax"
      description="Compliance details and the packaging/returns info buyers appreciate before ordering."
      columns={columns}
    >
      <FieldSet>
        <FieldLegend>Compliance</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="gst_rate">GST rate (%)</FieldLabel>
            <NativeSelect id="gst_rate" name="gst_rate" required aria-invalid={invalidFor("gst_rate")} value={v("gst_rate")} onChange={(e) => onValueChange("gst_rate", e.target.value)}>
              <NativeSelectOption value="" disabled>Select rate</NativeSelectOption>
              {PRODUCT_GST_RATES.map((r) => (
                <NativeSelectOption key={r} value={String(r)}>{r}%</NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>Applied on top of the base price.</FieldDescription>
            {errorFor("gst_rate")}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Packaging and returns</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="packaging_details">Packaging details (optional)</FieldLabel>
            <Textarea id="packaging_details" name="packaging_details" rows={3} value={v("packaging_details")} onChange={(e) => onValueChange("packaging_details", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="warranty_return">Warranty and returns (optional)</FieldLabel>
            <Textarea id="warranty_return" name="warranty_return" rows={3} value={v("warranty_return")} onChange={(e) => onValueChange("warranty_return", e.target.value)} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </FormSection>
  );
}