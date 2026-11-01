import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/dashboard/form-section";

export function ShippingTaxSection({
  formValues,
  onValueChange,
  columns = 1,
}: {
  formValues: Map<string, string>;
  onValueChange: (key: string, value: string) => void;
  columns?: 1 | 2;
}) {
  const v = (key: string): string => formValues.get(key) ?? "";

  return (
    <FormSection
      id="shipping-tax"
      title="Shipping & tax"
      description="The packaging and returns info buyers appreciate before ordering."
      columns={columns}
    >
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