import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSection } from "@/components/dashboard/form-section";
import { MAX_VARIANTS } from "@/lib/supplier/products";
import type { ExistingVariant, FieldErrorHelpers, InvalidField } from "./product-form-types";

export function VariantsSection({
  invalidFor,
  invalidField,
  hasVariants,
  onHasVariantsChange,
  variants,
  onUpdateVariant,
  addVariant,
  removeLastVariant,
}: {
  invalidFor: FieldErrorHelpers["invalidFor"];
  invalidField: InvalidField;
  hasVariants: boolean;
  onHasVariantsChange: (value: boolean) => void;
  variants: ExistingVariant[];
  onUpdateVariant: (index: number, patch: Partial<ExistingVariant>) => void;
  addVariant: () => void;
  removeLastVariant: () => void;
}) {
  return (
    <FormSection
      id="variants"
      title="Variants"
      description="Size, pack or colour variants are optional but convert better. Each has its own absolute price, SKU, MOQ and stock."
    >
      <FieldSet>
        <FieldLegend>Variants</FieldLegend>
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch id="variants-switch" checked={hasVariants} onCheckedChange={onHasVariantsChange} />
            <FieldLabel htmlFor="variants-switch">Size, pack, colour variants</FieldLabel>
          </Field>
          {hasVariants ? (
            <Field>
              <FieldDescription>Empty MOQ uses the base MOQ. Up to {MAX_VARIANTS} variants.</FieldDescription>
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
                        <Input id={`variant-${i}-label`} aria-label={`Variant ${i + 1} label`} required={hasVariants} aria-invalid={invalidFor(`variant-${i}-label`)} value={v.label} onChange={(e) => onUpdateVariant(i, { label: e.target.value })} placeholder="500ml – Pack of 12" />
                      </TableCell>
                      <TableCell>
                        <Input id={`variant-${i}-attr`} aria-label={`Variant ${i + 1} attribute`} value={`${v.attr_key ?? ""}${v.attr_value ? `: ${v.attr_value}` : ""}`} onChange={(e) => {
                          const [k, ...rest] = e.target.value.split(":");
                          onUpdateVariant(i, { attr_key: (k ?? "").trim(), attr_value: rest.join(":").trim() });
                        }} placeholder="size: 500ml" />
                      </TableCell>
                      <TableCell>
                        <Input id={`variant-${i}-sku`} aria-label={`Variant ${i + 1} SKU`} required={hasVariants} pattern="[A-Za-z0-9-_]{3,30}" aria-invalid={invalidFor(`variant-${i}-sku`)} value={v.seller_sku} onChange={(e) => onUpdateVariant(i, { seller_sku: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input id={`variant-${i}-price`} aria-label={`Variant ${i + 1} price`} required={hasVariants} type="number" min={0.01} step="0.01" aria-invalid={invalidFor(`variant-${i}-price`)} value={v.price || ""} onChange={(e) => onUpdateVariant(i, { price: Number(e.target.value) })} />
                      </TableCell>
                      <TableCell>
                        <Input id={`variant-${i}-moq`} aria-label={`Variant ${i + 1} MOQ`} type="number" min={1} step="1" aria-invalid={invalidFor(`variant-${i}-moq`)} value={v.moq ?? ""} onChange={(e) => onUpdateVariant(i, { moq: e.target.value === "" ? null : Number(e.target.value) })} placeholder="base" />
                      </TableCell>
                      <TableCell>
                        <Input id={`variant-${i}-stock`} aria-label={`Variant ${i + 1} stock`} type="number" min={0} step="1" aria-invalid={invalidFor(`variant-${i}-stock`)} value={v.stock_qty} onChange={(e) => onUpdateVariant(i, { stock_qty: Number(e.target.value) })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {invalidField?.id.startsWith("variant-") ? (
                <FieldError>{invalidField.message}</FieldError>
              ) : null}
              <ButtonGroup>
                <Button type="button" variant="outline" onClick={addVariant}>Add variant</Button>
                {variants.length > 1 ? (
                  <Button type="button" variant="ghost" onClick={removeLastVariant}>Remove last</Button>
                ) : null}
              </ButtonGroup>
            </Field>
          ) : null}
        </FieldGroup>
      </FieldSet>
    </FormSection>
  );
}