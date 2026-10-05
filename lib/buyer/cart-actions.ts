"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { fetchCustomerPriceMap } from "@/lib/storefront";
import {
  MIN_CART_VALUE,
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
    .select("id")
    .eq("id", productId)
    .eq("status", "approved")
    .eq("is_hidden", false)
    .maybeSingle();
  return data;
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

  if (!(await approvedProduct(supabase, productId))) {
    return errState("This product is no longer available.");
  }

  if (variantId) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id")
      .eq("id", variantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (!variant) {
      return errState("This variant is no longer available.");
    }
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
      .select("id, title, unit, moq, stock_qty, images:product_images(path, sort)")
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
    });
  }

  const summary = summarizeCart(lines, (line) =>
    priceForQuantity(priceMap.get(line.productId) ?? null, line.variantId, line.quantity),
  );

  return { ...summary, unavailableCount };
}

/** Total units in the buyer's cart, for the header badge. */
export async function getCartCount(supabase: SupabaseClient, buyerId: string): Promise<number> {
  const { data } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("buyer_id", buyerId);
  return ((data ?? []) as { quantity: number }[]).reduce((sum, r) => sum + r.quantity, 0);
}
