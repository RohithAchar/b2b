"use server";

import { revalidatePath } from "next/cache";
import { requireUser, getVerifiedSupplierId } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { submitProduct } from "./product-actions";

export async function submitProductAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) return;
  await submitProduct(productId);
  revalidatePath(`/supplier/dashboard/products/${productId}/images`);
}

export async function removeProductImageAction(productId: string, imagePath: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return;

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) return;

  const { data: existing } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  const remaining = (existing ?? [])
    .map((r) => r.path as string)
    .filter((p) => p !== imagePath);

  await supabase.rpc("replace_product_images", {
    p_product_id: productId,
    p_paths: remaining,
  });

  try {
    await supabase.storage.from("product_images").remove([imagePath]);
  } catch {
    // ignore
  }

  revalidatePath(`/supplier/dashboard/products/${productId}/images`);
}

export async function setPrimaryImageAction(productId: string, imagePath: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return;

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) return;

  const { data: existing } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  const paths = (existing ?? []).map((r) => r.path as string);
  if (!paths.includes(imagePath)) return;

  const reordered = [imagePath, ...paths.filter((p) => p !== imagePath)];
  await supabase.rpc("replace_product_images", {
    p_product_id: productId,
    p_paths: reordered,
  });

  revalidatePath(`/supplier/dashboard/products/${productId}/images`);
}
