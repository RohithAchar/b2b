"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSupplierContext } from "@/lib/auth/guard";
import { parseCouponForm } from "@/lib/supplier/coupons";

const BASE = "/supplier/dashboard/discounts";

export type CouponActionState = {
  ok: boolean;
  message: string;
};

const errState = (message: string): CouponActionState => ({ ok: false, message });

async function supplierCompanyId(supplierClient: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supplierClient.auth.getUser();
  if (!user) return null;
  const ctx = await getSupplierContext(supplierClient, user.id);
  return ctx?.companyId ?? null;
}

async function ownedCoupon(
  supplierClient: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  couponId: string,
) {
  const { data } = await supplierClient
    .from("coupons")
    .select("id")
    .eq("id", couponId)
    .eq("supplier_id", companyId)
    .maybeSingle();
  return !!data;
}

/** Flip a coupon's active flag. The toggle is the redemption gate. */
export async function toggleCoupon(couponId: string, active: boolean): Promise<CouponActionState> {
  const supabase = await createClient();
  const companyId = await supplierCompanyId(supabase);
  if (!companyId) {
    return errState("You must be signed in as a supplier.");
  }
  if (!(await ownedCoupon(supabase, companyId, couponId))) {
    return errState("Coupon not found.");
  }
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: active })
    .eq("id", couponId)
    .eq("supplier_id", companyId);
  if (error) {
    console.error("toggleCoupon failed:", error.code, error.message);
    return errState("Could not update the coupon. Try again.");
  }
  revalidatePath(BASE);
  return { ok: true, message: "" };
}

export async function createCoupon(
  _prev: CouponActionState,
  formData: FormData,
): Promise<CouponActionState | never> {
  const parsed = parseCouponForm(formData);
  if (!parsed.success) {
    return errState(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  }
  const values = parsed.data;

  // Per-type required rules.
  if (values.type === "percent" && (values.percent_value ?? 0) <= 0) {
    return errState("Percentage needs a value between 1 and 100.");
  }
  if (values.type === "percent" && (values.percent_value ?? 0) > 100) {
    return errState("Percentage cannot exceed 100.");
  }
  if (values.type === "flat" && (values.flat_value ?? 0) <= 0) {
    return errState("Flat discount needs an amount above ₹0.");
  }
  if (
    values.type === "buy_x_get_y" &&
    ((values.buy_quantity ?? 0) < 1 || (values.get_quantity ?? 0) < 1)
  ) {
    return errState("Buy X get Y needs both quantities of at least 1.");
  }
  if (values.type === "loyalty" && (values.loyalty_points ?? 0) < 1) {
    return errState("Loyalty needs at least 1 point.");
  }

  const supabase = await createClient();
  const companyId = await supplierCompanyId(supabase);
  if (!companyId) {
    return errState("You must be signed in as a supplier.");
  }

  let freeProductId: string | null = null;
  if (values.type === "freebie") {
    const raw = values.free_product_id?.trim() ?? "";
    if (!raw) {
      return errState("Choose the free product for this coupon.");
    }
    const uuid = z.string().uuid().safeParse(raw);
    if (!uuid.success) {
      return errState("Choose the free product for this coupon.");
    }
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", uuid.data)
      .eq("supplier_id", companyId)
      .maybeSingle();
    if (!product) {
      return errState("The chosen product is not one of yours.");
    }
    freeProductId = uuid.data;
  }

  let expiresAt: string | null = null;
  if (values.expires_at) {
    const at = new Date(`${values.expires_at}T23:59:59`);
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
      return errState("Expiry must be a future date.");
    }
    expiresAt = at.toISOString();
  }

  const { error } = await supabase.from("coupons").insert({
    supplier_id: companyId,
    code: values.code,
    type: values.type,
    is_active: true,
    percent_value: values.type === "percent" ? (values.percent_value as number) : null,
    max_discount: values.type === "percent" ? (values.max_discount as number | undefined) ?? null : null,
    flat_value: values.type === "flat" ? (values.flat_value as number) : null,
    min_order_value: (values.min_order_value as number | undefined) ?? 0,
    buy_quantity: values.type === "buy_x_get_y" ? (values.buy_quantity as number) : null,
    get_quantity: values.type === "buy_x_get_y" ? (values.get_quantity as number) : null,
    free_product_id: freeProductId,
    loyalty_points: values.type === "loyalty" ? (values.loyalty_points as number) : null,
    usage_limit: (values.usage_limit as number | undefined) ?? null,
    expires_at: expiresAt,
  });

  if (error) {
    if (error.code === "23505") {
      return errState("You already have a coupon with this code.");
    }
    console.error("createCoupon failed:", error.code, error.message);
    return errState("Could not create the coupon. Try again.");
  }

  revalidatePath(BASE);
  redirect(BASE);
}
