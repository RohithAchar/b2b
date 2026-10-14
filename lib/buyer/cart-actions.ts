"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { fetchCustomerPriceMap } from "@/lib/storefront";
import { logStorefrontEvent } from "@/lib/storefront/events";
import {
  describeCoupon,
  validateCouponForOrder,
  type CouponRule,
} from "@/lib/supplier/coupons";
import {
  MIN_CART_VALUE,
  moqViolation,
  priceForQuantity,
  summarizeCart,
  type CartLinePricing,
  type CartSummary,
} from "@/lib/buyer/cart";

// ---------------------------------------------------------------------------
// Add / update / remove
// ---------------------------------------------------------------------------

export type BuyerActionState = {
  ok: boolean;
  message: string;
};

const okState: BuyerActionState = { ok: true, message: "" };
const errState = (message: string): BuyerActionState => ({ ok: false, message });

const addToCartSchema = z.object({
  productId: z.string().uuid("Invalid product."),
  variantId: z.string().uuid().nullish(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
});

async function approvedProduct(supabase: SupabaseClient, productId: string) {
  const { data } = await supabase
    .from("products")
    .select("id, moq, unit, supplier_id")
    .eq("id", productId)
    .eq("status", "approved")
    .eq("is_hidden", false)
    .maybeSingle();
  return data as { id: string; moq: number; unit: string; supplier_id: string } | null;
}

async function variantRow(
  supabase: SupabaseClient,
  productId: string,
  variantId: string,
): Promise<{ moq: number | null } | null> {
  const { data } = await supabase
    .from("product_variants")
    .select("id, moq")
    .eq("id", variantId)
    .eq("product_id", productId)
    .maybeSingle();
  if (!data) return null;
  return { moq: (data.moq as number | null) ?? null };
}

export async function addToCart(
  _prev: BuyerActionState,
  formData: FormData,
): Promise<BuyerActionState> {
  const parsed = addToCartSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId") || undefined,
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return errState("Check the quantity and try again.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in to add items to your cart.");
  }

  const { productId, variantId, quantity } = parsed.data;

  const product = await approvedProduct(supabase, productId);
  if (!product) {
    return errState("This product is no longer available.");
  }

  let effectiveMoq = product.moq;
  if (variantId) {
    const variant = await variantRow(supabase, productId, variantId);
    if (!variant) {
      return errState("This variant is no longer available.");
    }
    effectiveMoq = variant.moq ?? product.moq;
  }

  const violation = moqViolation(quantity, effectiveMoq, product.unit);
  if (violation) {
    return errState(violation);
  }

  // Read-then-write instead of upsert: the unique constraint is NULLS NOT
  // DISTINCT, which PostgREST onConflict cannot reliably target for
  // base-product lines (variant_id null).
  const existingQuery = supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("buyer_id", user.id)
    .eq("product_id", productId);
  const { data: existing } = variantId
    ? await existingQuery.eq("variant_id", variantId).maybeSingle()
    : await existingQuery.is("variant_id", null).maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({
        quantity: (existing.quantity as number) + quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id as string)
      .eq("buyer_id", user.id);
    if (error) {
      console.error("addToCart update failed:", error.code, error.message);
      return errState("Could not update your cart. Try again.");
    }
  } else {
    const { error } = await supabase.from("cart_items").insert({
      buyer_id: user.id,
      product_id: productId,
      variant_id: variantId ?? null,
      quantity,
    });
    if (error) {
      console.error("addToCart insert failed:", error.code, error.message);
      return errState("Could not add to your cart. Try again.");
    }
  }

  revalidatePath("/cart");
  // Best-effort analytics; never blocks the buyer flow.
  await logStorefrontEvent({
    supplierId: product.supplier_id,
    productId,
    event: "cart",
    buyerId: user.id,
  });
  return okState;
}

const cartItemSchema = z.object({
  cartItemId: z.string().uuid("Invalid cart item."),
});

const updateQtySchema = cartItemSchema.extend({
  quantity: z.coerce.number().int(),
});

export async function updateCartQty(
  _prev: BuyerActionState,
  formData: FormData,
): Promise<BuyerActionState> {
  const parsed = updateQtySchema.safeParse({
    cartItemId: formData.get("cartItemId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return errState("Check the quantity and try again.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in.");
  }

  const { cartItemId, quantity } = parsed.data;

  // Zero or negative removes the line — the table forbids qty < 1.
  if (quantity <= 0) {
    return removeFromCart(_prev, formData);
  }

  const { data: line } = await supabase
    .from("cart_items")
    .select("id, product_id, variant_id")
    .eq("id", cartItemId)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (!line) {
    return errState("This item is no longer in your cart.");
  }

  const product = await approvedProduct(supabase, line.product_id as string);
  if (!product) {
    return errState("This product is no longer available.");
  }

  let effectiveMoq = product.moq;
  if (line.variant_id) {
    const variant = await variantRow(supabase, line.product_id as string, line.variant_id as string);
    if (!variant) {
      return errState("This variant is no longer available.");
    }
    effectiveMoq = variant.moq ?? product.moq;
  }

  const violation = moqViolation(quantity, effectiveMoq, product.unit);
  if (violation) {
    return errState(violation);
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", cartItemId)
    .eq("buyer_id", user.id);

  if (error) {
    console.error("updateCartQty failed:", error.code, error.message);
    return errState("Could not update your cart. Try again.");
  }

  revalidatePath("/cart");
  return okState;
}

export async function removeFromCart(
  _prev: BuyerActionState,
  formData: FormData,
): Promise<BuyerActionState> {
  const parsed = cartItemSchema.safeParse({
    cartItemId: formData.get("cartItemId"),
  });
  if (!parsed.success) {
    return errState("Invalid cart item.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in.");
  }

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", parsed.data.cartItemId)
    .eq("buyer_id", user.id);

  if (error) {
    console.error("removeFromCart failed:", error.code, error.message);
    return errState("Could not remove the item. Try again.");
  }

  revalidatePath("/cart");
  return okState;
}

// ---------------------------------------------------------------------------
// Summary (server-side priced; the ₹2,500 gate reads this, never the client)
// ---------------------------------------------------------------------------

export type CartSummaryResult = CartSummary & {
  /** Lines dropped because the product/variant became unavailable. */
  unavailableCount: number;
};

type CartItemRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
};

type CartProductRow = {
  id: string;
  title: string;
  unit: string;
  moq: number;
  stock_qty: number;
  supplier_id: string;
  images: { path: string; sort: number }[] | null;
};

type CartVariantRow = {
  id: string;
  product_id: string;
  label: string;
  moq: number | null;
  stock_qty: number;
};

export async function getCartSummary(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<CartSummaryResult> {
  const { data: items } = await supabase
    .from("cart_items")
    .select("id, product_id, variant_id, quantity")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: true });

  const rows = (items ?? []) as CartItemRow[];
  if (rows.length === 0) {
    return { lines: [], itemCount: 0, subtotal: 0, meetsMinimum: false, shortfall: MIN_CART_VALUE, unavailableCount: 0 };
  }

  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const variantIds = [...new Set(rows.map((r) => r.variant_id).filter((v): v is string => !!v))];

  const [{ data: products }, { data: variants }, priceMap] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, unit, moq, stock_qty, supplier_id, images:product_images(path, sort)")
      .in("id", productIds)
      .eq("status", "approved")
      .eq("is_hidden", false),
    variantIds.length > 0
      ? supabase
          .from("product_variants")
          .select("id, product_id, label, moq, stock_qty")
          .in("id", variantIds)
      : Promise.resolve({ data: [] as CartVariantRow[] }),
    fetchCustomerPriceMap(supabase, productIds),
  ]);

  const productMap = new Map(((products ?? []) as CartProductRow[]).map((p) => [p.id, p]));
  const variantMap = new Map(((variants ?? []) as CartVariantRow[]).map((v) => [v.id, v]));

  // Supplier display names via the public verified-only projection (buyers
  // cannot read the companies table directly).
  const supplierNames = new Map<string, string>();
  const supplierIds = [...new Set([...productMap.values()].map((p) => p.supplier_id))];
  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from("storefront_suppliers")
      .select("id, business_name")
      .in("id", supplierIds);
    for (const supplier of (suppliers ?? []) as { id: string; business_name: string }[]) {
      supplierNames.set(supplier.id, supplier.business_name);
    }
  }

  const lines: CartLinePricing[] = [];
  let unavailableCount = 0;

  for (const row of rows) {
    const product = productMap.get(row.product_id);
    if (!product) {
      unavailableCount += 1; // hidden, unapproved, or deleted
      continue;
    }
    const pricing = priceMap.get(row.product_id);
    if (!pricing) {
      unavailableCount += 1;
      continue;
    }

    let variant: CartVariantRow | undefined;
    if (row.variant_id) {
      variant = variantMap.get(row.variant_id);
      if (!variant) {
        unavailableCount += 1; // variant deleted
        continue;
      }
    }

    const images = [...(product.images ?? [])].sort((a, b) => a.sort - b.sort);
    lines.push({
      cartItemId: row.id,
      productId: product.id,
      variantId: variant?.id ?? null,
      title: variant ? `${product.title} — ${variant.label}` : product.title,
      unit: product.unit,
      moq: variant?.moq ?? product.moq,
      stockQty: variant?.stock_qty ?? product.stock_qty,
      quantity: row.quantity,
      imagePath: images[0]?.path ?? null,
      supplierId: product.supplier_id,
      supplierName: supplierNames.get(product.supplier_id) ?? "Unknown store",
    });
  }

  const summary = summarizeCart(lines, (line) =>
    priceForQuantity(priceMap.get(line.productId) ?? null, line.variantId, line.quantity),
  );

  return { ...summary, unavailableCount };
}

/** Distinct lines in the buyer's cart, for the header badge. */
export async function getCartCount(supabase: SupabaseClient, buyerId: string): Promise<number> {
  const { count } = await supabase
    .from("cart_items")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", buyerId);
  return count ?? 0;
}

/** Applied coupon codes by supplier, for hydrating the cart on load. */
export async function getCartCoupons(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("cart_coupons")
    .select("supplier_id, code")
    .eq("buyer_id", buyerId);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { supplier_id: string; code: string }[]) {
    map[row.supplier_id] = row.code;
  }
  return map;
}

/** Persist an applied code (upsert — one code per store). Best-effort. */
export async function saveCartCoupon(supplierId: string, rawCode: string): Promise<void> {
  try {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    if (!user) return;
    const { error } = await supabase.from("cart_coupons").upsert(
      { buyer_id: user.id, supplier_id: supplierId, code },
      { onConflict: "buyer_id,supplier_id" },
    );
    if (error) {
      console.error("saveCartCoupon failed:", error.code, error.message);
    }
  } catch (error) {
    console.error("saveCartCoupon failed:", error);
  }
}

/** Drop a persisted code. Best-effort. */
export async function clearCartCoupon(supplierId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const user = await getSessionUser(supabase);
    if (!user) return;
    const { error } = await supabase
      .from("cart_coupons")
      .delete()
      .eq("buyer_id", user.id)
      .eq("supplier_id", supplierId);
    if (error) {
      console.error("clearCartCoupon failed:", error.code, error.message);
    }
  } catch (error) {
    console.error("clearCartCoupon failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Coupon quotes (read-only; checkout revalidates before writing orders)
// ---------------------------------------------------------------------------

export type CouponQuote =
  | { ok: true; code: string; discount: number; description: string }
  | { ok: false; message: string };

const COUPON_RULE_COLUMNS =
  "id, code, type, is_active, percent_value, max_discount, flat_value, min_order_value, buy_quantity, get_quantity, free_product_id, loyalty_points, usage_limit, used_count, expires_at";

/**
 * Validate a coupon code against one supplier's lines in the buyer's cart.
 * The group subtotal is recomputed server-side — never trusted from the
 * client. A supplier with no lines in this cart is rejected, so codes
 * cannot be probed against stores the buyer is not buying from.
 */
export async function quoteCoupon(supplierId: string, rawCode: string): Promise<CouponQuote> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, message: "Enter a coupon code." };
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const summary = await getCartSummary(supabase, user.id);
  const groupSubtotal = summary.lines
    .filter((line) => line.supplierId === supplierId)
    .reduce((sum, line) => sum + line.lineTotal, 0);
  if (groupSubtotal <= 0) {
    return { ok: false, message: "No items from this store in your cart." };
  }

  // Authenticated buyers may read active coupons (coupons_select_active).
  // The code match stays exact so inactive/unknown codes are indistinguishable.
  const { data } = await supabase
    .from("coupons")
    .select(COUPON_RULE_COLUMNS)
    .eq("supplier_id", supplierId)
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) {
    return { ok: false, message: "This code is not valid for this store." };
  }
  const coupon = data as unknown as CouponRule;

  const result = validateCouponForOrder(coupon, groupSubtotal);
  if (!result.ok) {
    return { ok: false, message: result.reason };
  }

  let freeProductTitle: string | null = null;
  if (coupon.free_product_id) {
    const { data: product } = await supabase
      .from("products")
      .select("title")
      .eq("id", coupon.free_product_id)
      .maybeSingle();
    freeProductTitle = (product?.title as string | undefined) ?? null;
  }

  return {
    ok: true,
    code: coupon.code,
    discount: result.discount,
    description: describeCoupon(coupon, freeProductTitle),
  };
}
