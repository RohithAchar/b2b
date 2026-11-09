import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
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
      description="Buyers see your base price plus the margin set under Products → Margin. GST applies on top unless variants override it."
    >
      <FieldSet>
        <FieldLegend>Price</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch id="negotiable-switch" checked={negotiable} onCheckedChange={onNegotiableChange} />
            <FieldLabel htmlFor="negotiable-switch">Price negotiable</FieldLabel>
            <input type="hidden" name="negotiable" value={negotiable ? "1" : ""} />
          </Field>
        </FieldGroup>
      </FieldSet>
    </FormSection>
  );
}