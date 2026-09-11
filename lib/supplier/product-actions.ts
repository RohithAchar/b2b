"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_PRODUCT_IMAGES,
  MIN_PRODUCT_IMAGES,
  extractYoutubeId,
  productSchema,
  productVariantSchema,
  validateProductImageFile,
} from "@/lib/supplier/products";

export type ProductActionState = {
  ok: boolean;
  message: string;
  productId?: string;
};

const initialState: ProductActionState = { ok: false, message: "" };

function boolOf(v: FormDataEntryValue | null): boolean {
  return v === "on" || v === "true" || v === "1";
}

function nullIfEmpty(v: FormDataEntryValue | null): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function verifiedSupplierId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data || data.kyb_status !== "verified") return null;
  return data.id as string;
}

async function uploadProductImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${productId}_${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("product_images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Could not upload product image. Try again.");
  return path;
}

type ParsedVariant = {
  label: string;
  attrs: Record<string, string>;
  seller_sku: string;
  price: number;
  moq: number | null;
  stock_qty: number;
};

function parseVariants(raw: string | null): ParsedVariant[] | { error: string } {
  if (!raw || raw.trim() === "") return [];
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    return { error: "Variants are invalid." };
  }
  if (!Array.isArray(arr)) return { error: "Variants are invalid." };
  const out: ParsedVariant[] = [];
  const seen = new Set<string>();
  for (const [i, item] of arr.entries()) {
    const parsed = productVariantSchema.safeParse(item);
    if (!parsed.success) {
      return { error: `Variant ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid."}` };
    }
    const sku = parsed.data.seller_sku.toUpperCase();
    if (seen.has(sku)) return { error: `Variant ${i + 1}: duplicate SKU.` };
    seen.add(sku);
    const attrs: Record<string, string> = {};
    if (parsed.data.attr_key && parsed.data.attr_value) {
      attrs[parsed.data.attr_key] = parsed.data.attr_value;
    }
    out.push({
      label: parsed.data.label,
      attrs,
      seller_sku: sku,
      price: parsed.data.price,
      moq: parsed.data.moq ?? null,
      stock_qty: parsed.data.stock_qty,
    });
  }
  return out;
}

async function collectImages(formData: FormData): Promise<File[] | { error: string }> {
  const files = formData
    .getAll("images")
    .filter((v) => v instanceof File && v.size > 0) as File[];
  if (files.length > MAX_PRODUCT_IMAGES) {
    return { error: `You can upload up to ${MAX_PRODUCT_IMAGES} images.` };
  }
  for (const f of files) {
    const err = validateProductImageFile(f);
    if (err) return { error: `Image ${f.name}: ${err}` };
  }
  return files;
}

export async function createProduct(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const supplierId = await verifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ...initialState, message: "Only verified suppliers can list products." };

  // Wizard-completion token: rendered only on the Review step. Rejects any
  // POST that didn't come from a completed wizard pass.
  if (formData.get("wizard_complete") !== "1") {
    return { ...initialState, message: "Please complete all steps before saving." };
  }

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    category_id: formData.get("category_id"),
    brand: formData.get("brand") ?? "",
    seller_sku: formData.get("seller_sku"),
    hsn_code: formData.get("hsn_code"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    price_per_unit: formData.get("price_per_unit"),
    moq: formData.get("moq"),
    stock_qty: formData.get("stock_qty") ?? 0,
    negotiable: boolOf(formData.get("negotiable")),
    sample_available: boolOf(formData.get("sample_available")),
    sample_price: nullIfEmpty(formData.get("sample_price")),
    lead_time_days: formData.get("lead_time_days"),
    gst_rate: formData.get("gst_rate"),
    packaging_details: formData.get("packaging_details") ?? "",
    warranty_return: formData.get("warranty_return") ?? "",
    youtube_url: formData.get("youtube_url") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const variantsOrErr = parseVariants(nullIfEmpty(formData.get("variants_json")));
  if (!Array.isArray(variantsOrErr)) return { ok: false, message: variantsOrErr.error };
  const imagesOrErr = await collectImages(formData);
  if (!Array.isArray(imagesOrErr)) return { ok: false, message: imagesOrErr.error };

  const sku = parsed.data.seller_sku.toUpperCase();
  const { data: skuClash } = await supabase
    .from("products")
    .select("id")
    .eq("supplier_id", supplierId)
    .eq("seller_sku", sku)
    .maybeSingle();
  if (skuClash) return { ok: false, message: "You already use this SKU on another product." };

  const youtubeUrl = parsed.data.youtube_url?.trim() ? parsed.data.youtube_url.trim() : null;
  const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;

  const { data: product, error: insertError } = await supabase
    .from("products")
    .insert({
      supplier_id: supplierId,
      category_id: parsed.data.category_id,
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      brand: parsed.data.brand?.trim() ? parsed.data.brand.trim() : null,
      seller_sku: sku,
      hsn_code: parsed.data.hsn_code.trim(),
      unit: parsed.data.unit,
      price_per_unit: parsed.data.price_per_unit,
      moq: parsed.data.moq,
      stock_qty: parsed.data.stock_qty,
      negotiable: parsed.data.negotiable,
      sample_available: parsed.data.sample_available,
      sample_price: parsed.data.sample_price ?? null,
      lead_time_days: parsed.data.lead_time_days,
      gst_rate: parsed.data.gst_rate,
      packaging_details: parsed.data.packaging_details?.trim() ? parsed.data.packaging_details.trim() : null,
      warranty_return: parsed.data.warranty_return?.trim() ? parsed.data.warranty_return.trim() : null,
      youtube_url: youtubeUrl,
      youtube_id: youtubeId,
      status: "draft",
    })
    .select("id")
    .single();
  if (insertError || !product) {
    console.error("createProduct insert failed:", insertError);
    return { ok: false, message: "Could not save. Try again." };
  }

  try {
    let sort = 0;
    for (const file of imagesOrErr) {
      const path = await uploadProductImage(supabase, user.id, product.id, file);
      await supabase.from("product_images").insert({
        product_id: product.id,
        path,
        sort: sort++,
      });
    }
    let vsort = 0;
    for (const v of variantsOrErr) {
      await supabase.from("product_variants").insert({
        product_id: product.id,
        label: v.label,
        attrs: v.attrs,
        seller_sku: v.seller_sku,
        price: v.price,
        moq: v.moq,
        stock_qty: v.stock_qty,
        sort: vsort++,
      });
    }
  } catch (err) {
    console.error("createProduct media failed:", err);
    return { ok: false, message: "Product saved but media upload failed. Edit to retry.", productId: product.id };
  }

  revalidatePath("/supplier/dashboard/products");
  return { ok: true, message: "Saved as draft.", productId: product.id };
}

export async function updateProduct(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const supplierId = await verifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only verified suppliers can list products." };

  // Wizard-completion token: rendered only on the Review step. Rejects any
  // POST that didn't come from a completed wizard pass.
  if (formData.get("wizard_complete") !== "1") {
    return { ok: false, message: "Please complete all steps before saving." };
  }

  const { data: existing } = await supabase
    .from("products")
    .select("id, supplier_id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!existing || existing.supplier_id !== supplierId) {
    return { ok: false, message: "Product not found." };
  }
  if (existing.status === "approved" || existing.status === "pending") {
    return { ok: false, message: "Only draft or returned products can be edited." };
  }

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    category_id: formData.get("category_id"),
    brand: formData.get("brand") ?? "",
    seller_sku: formData.get("seller_sku"),
    hsn_code: formData.get("hsn_code"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    price_per_unit: formData.get("price_per_unit"),
    moq: formData.get("moq"),
    stock_qty: formData.get("stock_qty") ?? 0,
    negotiable: boolOf(formData.get("negotiable")),
    sample_available: boolOf(formData.get("sample_available")),
    sample_price: nullIfEmpty(formData.get("sample_price")),
    lead_time_days: formData.get("lead_time_days"),
    gst_rate: formData.get("gst_rate"),
    packaging_details: formData.get("packaging_details") ?? "",
    warranty_return: formData.get("warranty_return") ?? "",
    youtube_url: formData.get("youtube_url") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const imagesOrErr = await collectImages(formData);
  if (!Array.isArray(imagesOrErr)) return { ok: false, message: imagesOrErr.error };

  const youtubeUrl = parsed.data.youtube_url?.trim() ? parsed.data.youtube_url.trim() : null;

  const { error } = await supabase
    .from("products")
    .update({
      category_id: parsed.data.category_id,
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      brand: parsed.data.brand?.trim() ? parsed.data.brand.trim() : null,
      hsn_code: parsed.data.hsn_code.trim(),
      unit: parsed.data.unit,
      price_per_unit: parsed.data.price_per_unit,
      moq: parsed.data.moq,
      stock_qty: parsed.data.stock_qty,
      negotiable: parsed.data.negotiable,
      sample_available: parsed.data.sample_available,
      sample_price: parsed.data.sample_price ?? null,
      lead_time_days: parsed.data.lead_time_days,
      gst_rate: parsed.data.gst_rate,
      packaging_details: parsed.data.packaging_details?.trim() ? parsed.data.packaging_details.trim() : null,
      warranty_return: parsed.data.warranty_return?.trim() ? parsed.data.warranty_return.trim() : null,
      youtube_url: youtubeUrl,
      youtube_id: youtubeUrl ? extractYoutubeId(youtubeUrl) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) {
    console.error("updateProduct failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  if (imagesOrErr.length > 0) {
    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    try {
      let sort = count ?? 0;
      for (const file of imagesOrErr) {
        const path = await uploadProductImage(supabase, user.id, productId, file);
        await supabase.from("product_images").insert({
          product_id: productId,
          path,
          sort: sort++,
        });
      }
    } catch (err) {
      console.error("updateProduct media failed:", err);
      return { ok: false, message: "Product saved but media upload failed. Edit to retry.", productId };
    }
  }

  revalidatePath("/supplier/dashboard/products");
  return { ok: true, message: "Saved." };
}

export async function submitProduct(productId: string): Promise<ProductActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const supplierId = await verifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only verified suppliers can list products." };

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) < MIN_PRODUCT_IMAGES) {
    return { ok: false, message: `Add at least ${MIN_PRODUCT_IMAGES} images before submitting.` };
  }

  const { error } = await supabase
    .from("products")
    .update({ status: "pending", submitted_at: new Date().toISOString(), rejection_note: null })
    .eq("id", productId)
    .eq("supplier_id", supplierId)
    .in("status", ["draft", "rejected"]);
  if (error) {
    console.error("submitProduct failed:", error);
    return { ok: false, message: "Could not submit. Try again." };
  }
  revalidatePath("/supplier/dashboard/products");
  revalidatePath("/admin/dashboard/products");
  return { ok: true, message: "Submitted for approval." };
}

export async function deleteProduct(productId: string): Promise<ProductActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const supplierId = await verifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only verified suppliers can list products." };

  const { data: images } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("supplier_id", supplierId)
    .in("status", ["draft", "rejected"]);
  if (error) {
    console.error("deleteProduct failed:", error);
    return { ok: false, message: "Could not delete. Try again." };
  }
  if (images && images.length > 0) {
    await supabase.storage.from("product_images").remove(images.map((i) => i.path));
  }
  revalidatePath("/supplier/dashboard/products");
  return { ok: true, message: "Deleted." };
}
