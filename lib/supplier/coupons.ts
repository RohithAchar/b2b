// Supplier coupons: rule descriptions, eligibility validation and discount
// math. Pure and dependency-free so the future checkout flow and unit tests
// share one implementation. `is_active` is the redemption gate; usage,
// expiry, minimums and caps are enforced here, never in UI code.
import { z } from "zod";
import { formatRupees } from "@/lib/format";

export const COUPON_TYPES = [
  "percent",
  "flat",
  "buy_x_get_y",
  "free_shipping",
  "freebie",
  "loyalty",
] as const;

export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  percent: "Percent discount",
  flat: "Flat discount",
  buy_x_get_y: "Buy X get Y",
  free_shipping: "Free shipping",
  freebie: "Freebie",
  loyalty: "Loyalty points",
};

export function parseCouponType(raw: unknown): CouponType | null {
  if (typeof raw === "string" && (COUPON_TYPES as readonly string[]).includes(raw)) {
    return raw as CouponType;
  }
  return null;
}

export type CouponRule = {
  id: string;
  code: string;
  type: CouponType;
  is_active: boolean;
  percent_value: number | null;
  max_discount: number | null;
  flat_value: number | null;
  min_order_value: number;
  buy_quantity: number | null;
  get_quantity: number | null;
  free_product_id: string | null;
  loyalty_points: number | null;
  usage_limit: number | null;
  used_count: number;
  expires_at: string | null;
};

function aboveLine(minOrderValue: number): string {
  return minOrderValue > 0 ? ` on orders above ${formatRupees(minOrderValue)}` : " on all orders";
}

/** Human-readable rule summary, e.g. "10% off (up to ₹9,999) on orders above ₹5,000". */
export function describeCoupon(
  coupon: Pick<
    CouponRule,
    | "type"
    | "percent_value"
    | "max_discount"
    | "flat_value"
    | "min_order_value"
    | "buy_quantity"
    | "get_quantity"
    | "loyalty_points"
  >,
  freeProductTitle?: string | null,
): string {
  const line = aboveLine(coupon.min_order_value);
  switch (coupon.type) {
    case "percent": {
      const pct = Number(coupon.percent_value ?? 0);
      const pctLabel = Number.isInteger(pct) ? `${pct}` : `${pct}`;
      const cap = coupon.max_discount != null ? ` (up to ${formatRupees(coupon.max_discount)})` : "";
      return `${pctLabel}% off${cap}${line}`;
    }
    case "flat":
      return `${formatRupees(coupon.flat_value ?? 0)} off${line}`;
    case "buy_x_get_y": {
      const buy = coupon.buy_quantity ?? 0;
      const get = coupon.get_quantity ?? 0;
      return `Buy ${buy} get ${get} free${line}`;
    }
    case "free_shipping":
      return `Free shipping${line}`;
    case "freebie": {
      const what = freeProductTitle ? ` ${freeProductTitle}` : " gift";
      const base = coupon.min_order_value > 0 ? `Free${what} above` : `Free${what} with every order`;
      return coupon.min_order_value > 0
        ? `${base} ${formatRupees(coupon.min_order_value)}`
        : base;
    }
    case "loyalty": {
      const points = coupon.loyalty_points ?? 0;
      return `Earn ${points} loyalty point${points === 1 ? "" : "s"}${line}`;
    }
  }
}

export type CouponEligibility =
  | { ok: true; discount: number }
  | { ok: false; reason: string };

const optionalPositiveInt = z
  .preprocess((v) => (v === null ? undefined : v), z.string().trim().optional())
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isInteger(v) && (v as number) >= 0), {
    message: "Enter a whole number of 0 or more.",
  });

const nullToUndefinedString = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.string().trim().optional(),
);

const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Code needs at least 3 characters.")
    .max(24, "Code can be at most 24 characters.")
    .regex(/^[A-Za-z0-9-_]+$/, "Letters, numbers, - and _ only.")
    .transform((v) => v.toUpperCase()),
  type: z.enum(COUPON_TYPES),
  percent_value: optionalPositiveInt,
  max_discount: optionalPositiveInt,
  flat_value: optionalPositiveInt,
  min_order_value: optionalPositiveInt,
  buy_quantity: optionalPositiveInt,
  get_quantity: optionalPositiveInt,
  free_product_id: nullToUndefinedString,
  loyalty_points: optionalPositiveInt,
  usage_limit: optionalPositiveInt,
  expires_at: nullToUndefinedString,
});

/** Parse raw coupon form data. Missing keys arrive as null from FormData
 * when their inputs are not rendered for the chosen coupon type. */
export function parseCouponForm(formData: FormData) {
  return createCouponSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
    percent_value: formData.get("percent_value"),
    max_discount: formData.get("max_discount"),
    flat_value: formData.get("flat_value"),
    min_order_value: formData.get("min_order_value"),
    buy_quantity: formData.get("buy_quantity"),
    get_quantity: formData.get("get_quantity"),
    free_product_id: formData.get("free_product_id"),
    loyalty_points: formData.get("loyalty_points"),
    usage_limit: formData.get("usage_limit"),
    expires_at: formData.get("expires_at"),
  });
}

/**
 * Check a coupon against an order subtotal. Discount is the priced reduction
 * for percent/flat; other types fulfil at checkout (free item, shipping,
 * points) so their priced discount is 0.
 */
export function validateCouponForOrder(
  coupon: CouponRule,
  subtotal: number,
  now: Date = new Date(),
): CouponEligibility {
  if (!coupon.is_active) {
    return { ok: false, reason: "This coupon is not active." };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: "This coupon has expired." };
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (subtotal < coupon.min_order_value) {
    return {
      ok: false,
      reason: `Requires a minimum order of ${formatRupees(coupon.min_order_value)}.`,
    };
  }

  if (coupon.type === "percent") {
    const raw = (subtotal * Number(coupon.percent_value ?? 0)) / 100;
    const capped = coupon.max_discount != null ? Math.min(raw, coupon.max_discount) : raw;
    return { ok: true, discount: Math.max(0, Math.round(capped)) };
  }
  if (coupon.type === "flat") {
    return { ok: true, discount: Math.max(0, Math.min(coupon.flat_value ?? 0, subtotal)) };
  }
  return { ok: true, discount: 0 };
}
