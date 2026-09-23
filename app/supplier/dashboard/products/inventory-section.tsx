import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormSection } from "@/components/dashboard/form-section";
import type { FieldErrorHelpers } from "./product-form-types";

export function InventorySection({
  invalidFor,
  errorFor,
  formValues,
  onValueChange,
  sampleAvailable,
  onSampleAvailableChange,
}: {
  invalidFor: FieldErrorHelpers["invalidFor"];
  errorFor: FieldErrorHelpers["errorFor"];
  formValues: Map<string, string>;
  onValueChange: (key: string, value: string) => void;
  sampleAvailable: boolean;
  onSampleAvailableChange: (value: boolean) => void;
}) {
  const v = (key: string): string => formValues.get(key) ?? "";

  return (
    <FormSection
      id="inventory"
      title="Inventory"
      description="Stock levels, sampling and turnaround for this listing."
    >
      <FieldSet>
        <FieldLegend>Stock</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="stock_qty">Stock on hand</FieldLabel>
            <Input id="stock_qty" name="stock_qty" type="number" min={0} step="1" aria-invalid={invalidFor("stock_qty")} value={v("stock_qty") || "0"} onChange={(e) => onValueChange("stock_qty", e.target.value)} />
            {errorFor("stock_qty")}
          </Field>
          <Field>
            <FieldLabel htmlFor="lead_time_days">Lead time (days)</FieldLabel>
            <Input id="lead_time_days" name="lead_time_days" required type="number" min={1} max={90} step="1" aria-invalid={invalidFor("lead_time_days")} value={v("lead_time_days")} onChange={(e) => onValueChange("lead_time_days", e.target.value)} placeholder="15" />
            {errorFor("lead_time_days")}
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend>Sampling</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch id="sample-switch" checked={sampleAvailable} onCheckedChange={onSampleAvailableChange} />
            <FieldLabel htmlFor="sample-switch">Offer sample</FieldLabel>
            <input type="hidden" name="sample_available" value={sampleAvailable ? "1" : ""} />
          </Field>
          {sampleAvailable ? (
            <Field>
              <FieldLabel htmlFor="sample_price">Sample price (₹)</FieldLabel>
              <Input id="sample_price" name="sample_price" type="number" min={0.01} step="0.01" aria-invalid={invalidFor("sample_price")} value={v("sample_price")} onChange={(e) => onValueChange("sample_price", e.target.value)} />
              {errorFor("sample_price")}
            </Field>
          ) : null}
        </FieldGroup>
      </FieldSet>
    </FormSection>
  );
}