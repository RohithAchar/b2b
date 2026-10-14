"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { createCoupon, type CouponActionState } from "@/lib/supplier/coupon-actions";
import { COUPON_TYPES, COUPON_TYPE_LABELS, type CouponType } from "@/lib/supplier/coupons";

const initialState: CouponActionState = { ok: false, message: "" };

function NumberField({
  id,
  name,
  label,
  description,
  placeholder,
  required,
}: {
  id: string;
  name: string;
  label: string;
  description: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={name}
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={placeholder}
        required={required}
      />
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

/** Coupon builder: shared rules always visible, type rules unfold by selection. */
export function CouponForm({ products }: { products: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(createCoupon, initialState);
  const [type, setType] = useState<CouponType>("percent");

  return (
    <form action={action}>
      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="coupon-code">Coupon code</FieldLabel>
            <Input
              id="coupon-code"
              name="code"
              required
              minLength={3}
              maxLength={24}
              autoComplete="off"
              placeholder="FESTIVE10"
              className="uppercase"
            />
            <FieldDescription>Letters, numbers, - and _ only.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="coupon-type">Coupon type</FieldLabel>
            <NativeSelect
              id="coupon-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as CouponType)}
              className="w-full"
            >
              {COUPON_TYPES.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {COUPON_TYPE_LABELS[option]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>New coupons start active.</FieldDescription>
          </Field>
        </div>

        {type === "percent" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              id="coupon-percent"
              name="percent_value"
              label="Discount percent"
              description="1 to 100."
              placeholder="10"
              required
            />
            <NumberField
              id="coupon-cap"
              name="max_discount"
              label="Maximum discount (₹)"
              description="Optional cap on the percent discount."
              placeholder="9999"
            />
          </div>
        )}
        {type === "flat" && (
          <NumberField
            id="coupon-flat"
            name="flat_value"
            label="Flat discount (₹)"
            description="Fixed rupees off the order."
            placeholder="500"
            required
          />
        )}
        {type === "buy_x_get_y" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              id="coupon-buy"
              name="buy_quantity"
              label="Buy quantity"
              description="Paid units to qualify."
              placeholder="2"
              required
            />
            <NumberField
              id="coupon-get"
              name="get_quantity"
              label="Get quantity"
              description="Free units earned."
              placeholder="1"
              required
            />
          </div>
        )}
        {type === "freebie" && (
          <Field>
            <FieldLabel htmlFor="coupon-free-product">Free product</FieldLabel>
            {products.length === 0 ? (
              <FieldDescription>
                Add a product first — a freebie needs one of your listings.
              </FieldDescription>
            ) : (
              <NativeSelect id="coupon-free-product" name="free_product_id" className="w-full" required>
                <NativeSelectOption value="">Choose a product…</NativeSelectOption>
                {products.map((product) => (
                  <NativeSelectOption key={product.id} value={product.id}>
                    {product.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </Field>
        )}
        {type === "loyalty" && (
          <NumberField
            id="coupon-points"
            name="loyalty_points"
            label="Loyalty points"
            description="Points awarded per redemption."
            placeholder="100"
            required
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField
            id="coupon-min"
            name="min_order_value"
            label="Minimum order (₹)"
            description="0 means no minimum."
            placeholder="0"
          />
          <NumberField
            id="coupon-limit"
            name="usage_limit"
            label="Usage limit"
            description="Empty means unlimited."
            placeholder="100"
          />
          <Field>
            <FieldLabel htmlFor="coupon-expiry">Expiry date</FieldLabel>
            <Input id="coupon-expiry" name="expires_at" type="date" />
            <FieldDescription>Empty means never expires.</FieldDescription>
          </Field>
        </div>

        {state.message ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Creating…
            </>
          ) : (
            "Create coupon"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
}
