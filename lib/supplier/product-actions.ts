"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, getVerifiedSupplierId } from "@/lib/auth/guard";
import {
  MAX_PRODUCT_IMAGES,
  MIN_PRODUCT_IMAGES,
  extractYoutubeId,
  orderImagePaths,
  productSchema,
  productVariantSchema,
  resolvePrimaryImagePath,
  validateProductImageFile,
} from "@/lib/supplier/products";
import { defaultSeoDescription, defaultSeoTitle } from "@/lib/supplier/rich-text";
import { sanitizeRichText } from "@/lib/supplier/sanitize";
import { indexProductImages } from "@/lib/ai/index-product-image";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function uploadProductImage(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  productId: string,
  file: File,
  folder: string | null = null,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = folder
    ? `${userId}/${folder}/${productId}_${Date.now()}_${safeName}`
    : `${userId}/${productId}_${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("product_images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Could not upload product image. Try again.");
  return path;
}

async function removeStoredPaths(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from("product_images").remove(paths);
  if (error) {
    console.error("storage cleanup failed:", error);
  }
}

async function uploadImages(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  productId: string,
  files: File[],
): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadProductImage(supabase, userId, productId, file));
    }
  } catch (err) {
    await removeStoredPaths(supabase, uploaded);
    throw err;
  }
  return uploaded;
}

function variantRpcPayload(variants: ParsedVariant[]) {
  return variants.map((v) => ({
    label: v.label,
    attrs: v.attrs,
    seller_sku: v.seller_sku,
    price: v.price,
    moq: v.moq,
    stock_qty: v.stock_qty,
  }));
}

async function rollbackCreatedProduct(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  supplierId: string,
  productId: string,
  uploadedPaths: string[],
): Promise<void> {
  await removeStoredPaths(supabase, uploadedPaths);
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("supplier_id", supplierId);
  if (error) {
    console.error("createProduct rollback delete failed:", error);
  }
}

function rpcMessage(error: { message?: string } | null, fallback: string): string {
  return error?.message ? error.message : fallback;
}

/**
 * Index the product's images so they can be found by search-by-image.
 *
 * Called after the last database mutation of a save, so a rolled-back product is
 * never embedded. Strictly best-effort: missing service-role credentials, a
 * model that cannot load, or a storage error are logged and left to
 * `pnpm embeddings:backfill`, which is resumable. A product save must never
 * fail because the search index did not update.
 *
 * Uses the service-role client because product_image_embeddings grants nothing
 * to authenticated, so embedding writes cannot be done with the caller's token.
 */
async function indexImagesForSearch(productId: string): Promise<void> {
  try {
    await indexProductImages(createAdminClient(), productId);
  } catch (err) {
    console.error(
      `[image-search] skipped indexing for product ${productId}: ${(err as Error).message}`,
    );
  }
}

type ParsedVariant = {
  id?: string;
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
      id: typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : undefined,
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

function parseRemovedPaths(raw: string | null): string[] {
  if (!raw || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((p): p is string => typeof p === "string" && p.length > 0);
}

async function collectImages(formData: FormData): Promise<File[] | { error: string }> {
  const files = formData
    .getAll("images")
    .filter((v) => v instanceof File && v.size > 0) as File[];
  if (files.length > MAX_PRODUCT_IMAGES) {
    return { error: `You can upload up to ${MAX_PRODUCT_IMAGES} images.` };
  }
  for (const f of files) {
    const err = await validateProductImageFile(f);
    if (err) return { error: `Image ${f.name}: ${err}` };
  }
  return files;
}

async function collectSeoFile(
  formData: FormData,
): Promise<{ seoFile: File | null } | { error: string }> {
  const raw = formData.get("seo_image");
  if (!(raw instanceof File) || raw.size === 0) return { seoFile: null };
  const err = await validateProductImageFile(raw);
  if (err) return { error: `Search image: ${err}` };
  return { seoFile: raw };
}

function seoText(v: string | undefined | null): string | null {
  const s = v?.trim() ?? "";
  return s === "" ? null : s;
}

async function submitForApproval(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  supplierId: string,
  productId: string,
): Promise<{ ok: boolean; message: string }> {
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) < MIN_PRODUCT_IMAGES) {
    return { ok: false, message: `Add at least ${MIN_PRODUCT_IMAGES} images before submitting.` };
  }
  const { error } = await supabase.rpc("submit_product_for_approval", {
    p_product_id: productId,
  });
  if (error) {
    console.error("submitForApproval failed:", error);
    return { ok: false, message: rpcMessage(error, "Saved, but could not submit for approval. Try again.") };
  }
  return { ok: true, message: "Saved and published." };
}

export async function createProduct(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ...initialState, message: "Only suppliers can list products." };

  // Wizard-completion token: rendered only on the Review step. Rejects any
  // POST that didn't come from a completed wizard pass.
  if (formData.get("wizard_complete") !== "1") {
    return { ...initialState, message: "Please complete all steps before saving." };
  }

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    category_id: formData.get("category_id"),
    seller_sku: formData.get("seller_sku"),
    hsn_code: formData.get("hsn_code"),
    gst_rate: formData.get("gst_rate"),
    carton_units: formData.get("carton_units"),
    carton_dimensions: formData.get("carton_dimensions") ?? "",
    carton_weight_kg: formData.get("carton_weight_kg"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    price_per_unit: formData.get("price_per_unit"),
    negotiable: boolOf(formData.get("negotiable")),
    is_winning: boolOf(formData.get("is_winning")),
    is_hot_selling: boolOf(formData.get("is_hot_selling")),
    packaging_details: formData.get("packaging_details") ?? "",
    warranty_return: formData.get("warranty_return") ?? "",
    youtube_url: formData.get("youtube_url") ?? "",
    seo_title: formData.get("seo_title") ?? "",
    seo_description: formData.get("seo_description") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const variantsOrErr = parseVariants(nullIfEmpty(formData.get("variants_json")));
  if (!Array.isArray(variantsOrErr)) return { ok: false, message: variantsOrErr.error };
  const imagesOrErr = await collectImages(formData);
  if (!Array.isArray(imagesOrErr)) return { ok: false, message: imagesOrErr.error };
  
  // If submitting for approval, require images BEFORE creating the product
  // so we don't create a draft with 0 images that can never be published.
  if (boolOf(formData.get("auto_submit")) && imagesOrErr.length < MIN_PRODUCT_IMAGES) {
    return {
      ok: false,
      message: `Add at least ${MIN_PRODUCT_IMAGES} images before submitting.`,
    };
  }
  const seoChoice = await collectSeoFile(formData);
  if ("error" in seoChoice) return { ok: false, message: seoChoice.error };

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

  const storeId = (formData.get("store_id") as string | null) || null;

  const { data: product, error: insertError } = await supabase
    .from("products")
    .insert({
      supplier_id: supplierId,
      store_id: storeId,
      category_id: parsed.data.category_id,
      title: parsed.data.title.trim(),
      description: sanitizeRichText(parsed.data.description),
      seller_sku: sku,
      hsn_code: parsed.data.hsn_code.trim(),
      gst_rate: parsed.data.gst_rate,
      carton_units: parsed.data.carton_units,
      carton_dimensions: parsed.data.carton_dimensions?.trim()
        ? parsed.data.carton_dimensions.trim()
        : null,
      carton_weight_kg: parsed.data.carton_weight_kg,
      unit: parsed.data.unit,
      price_per_unit: parsed.data.price_per_unit,
      // No longer collected in the form; defaults keep existing storefront and
      // cart behaviour working (MOQ floor of 1, no stock, one-week lead time).
      moq: 1,
      stock_qty: 0,
      lead_time_days: 7,
      negotiable: parsed.data.negotiable,
      is_winning: parsed.data.is_winning,
      is_hot_selling: parsed.data.is_hot_selling,
      sample_available: false,
      sample_price: null,
      packaging_details: parsed.data.packaging_details?.trim() ? parsed.data.packaging_details.trim() : null,
      warranty_return: parsed.data.warranty_return?.trim() ? parsed.data.warranty_return.trim() : null,
      youtube_url: youtubeUrl,
      youtube_id: youtubeId,
      seo_title: seoText(parsed.data.seo_title) ?? defaultSeoTitle(parsed.data.title),
      seo_description: seoText(parsed.data.seo_description) ?? defaultSeoDescription(parsed.data.description),
      status: "draft",
    })
    .select("id")
    .single();
  if (insertError || !product) {
    console.error("createProduct insert failed:", insertError);
    if (insertError?.code === "23505") {
      return { ok: false, message: "You already use this SKU on another product." };
    }
    return { ok: false, message: "Could not save. Try again." };
  }

  // Upload images to storage first so a failed upload never leaves DB rows
  // behind, then publish the DB rows through the atomic replacement RPCs.
  let uploadedPaths: string[] = [];
  let seoUploadedPath: string | null = null;
  try {
    uploadedPaths = await uploadImages(supabase, user.id, product.id, imagesOrErr);
    if (seoChoice.seoFile) {
      seoUploadedPath = await uploadProductImage(supabase, user.id, product.id, seoChoice.seoFile, "seo");
    }
  } catch (err) {
    console.error("createProduct image upload failed:", err);
    await rollbackCreatedProduct(
      supabase,
      supplierId,
      product.id,
      seoUploadedPath ? [...uploadedPaths, seoUploadedPath] : uploadedPaths,
    );
    return { ok: false, message: "Could not upload product images. Make sure the files are valid and try again." };
  }

  const { error: imageRowsError } = await supabase.rpc("replace_product_images", {
    p_product_id: product.id,
    p_paths: orderImagePaths(
      uploadedPaths,
      resolvePrimaryImagePath(String(formData.get("primary_image") ?? ""), [], uploadedPaths),
    ),
  });
  if (imageRowsError) {
    console.error("createProduct image rows failed:", imageRowsError);
    await rollbackCreatedProduct(supabase, supplierId, product.id, uploadedPaths);
    return { ok: false, message: rpcMessage(imageRowsError, "Could not save product images. Try again.") };
  }

  const { error: variantsError } = await supabase.rpc("replace_product_variants", {
    p_product_id: product.id,
    p_variants: variantRpcPayload(variantsOrErr),
  });
  if (variantsError) {
    console.error("createProduct variants failed:", variantsError);
    await rollbackCreatedProduct(supabase, supplierId, product.id, uploadedPaths);
    return { ok: false, message: rpcMessage(variantsError, "Could not save variants. Try again.") };
  }

  if (seoChoice.seoFile && seoUploadedPath) {
    const { error: seoUpdateError } = await supabase.from("products").update({
      seo_image_path: seoUploadedPath,
    })
      .eq("id", product.id);
    if (seoUpdateError) {
      console.error("createProduct seo path update failed:", seoUpdateError);
      await rollbackCreatedProduct(supabase, supplierId, product.id, [...uploadedPaths, seoUploadedPath]);
      return { ok: false, message: "Could not save search image. Try again." };
    }
  }

  await indexImagesForSearch(product.id);

  revalidatePath("/supplier/dashboard/products");
  if (boolOf(formData.get("auto_submit"))) {
    const res = await submitForApproval(supabase, supplierId, product.id);
    if (!res.ok) return { ok: false, message: res.message, productId: product.id };
    revalidatePath("/admin/dashboard/products");
    return { ok: true, message: res.message, productId: product.id };
  }
  return { ok: true, message: "Saved as draft.", productId: product.id };
}

export async function updateProduct(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only suppliers can list products." };

  // Wizard-completion token: rendered only on the Review step. Rejects any
  // POST that didn't come from a completed wizard pass.
  if (formData.get("wizard_complete") !== "1") {
    return { ok: false, message: "Please complete all steps before saving." };
  }

  const { data: existing } = await supabase
    .from("products")
    .select("id, supplier_id, status, seo_image_path")
    .eq("id", productId)
    .maybeSingle();
  if (!existing || existing.supplier_id !== supplierId) {
    return { ok: false, message: "Product not found." };
  }
  if (existing.status === "pending") {
    return { ok: false, message: "This product is under review and cannot be edited right now." };
  }

  const parsed = productSchema.safeParse({
    title: formData.get("title"),
    category_id: formData.get("category_id"),
    seller_sku: formData.get("seller_sku"),
    hsn_code: formData.get("hsn_code"),
    gst_rate: formData.get("gst_rate"),
    carton_units: formData.get("carton_units"),
    carton_dimensions: formData.get("carton_dimensions") ?? "",
    carton_weight_kg: formData.get("carton_weight_kg"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    price_per_unit: formData.get("price_per_unit"),
    negotiable: boolOf(formData.get("negotiable")),
    is_winning: boolOf(formData.get("is_winning")),
    is_hot_selling: boolOf(formData.get("is_hot_selling")),
    packaging_details: formData.get("packaging_details") ?? "",
    warranty_return: formData.get("warranty_return") ?? "",
    youtube_url: formData.get("youtube_url") ?? "",
    seo_title: formData.get("seo_title") ?? "",
    seo_description: formData.get("seo_description") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const imagesOrErr = await collectImages(formData);
  if (!Array.isArray(imagesOrErr)) return { ok: false, message: imagesOrErr.error };

  const seoChoice = await collectSeoFile(formData);
  if ("error" in seoChoice) return { ok: false, message: seoChoice.error };
  const seoClear = formData.get("seo_image_clear") === "1";

  const variantsOrErr = parseVariants(nullIfEmpty(formData.get("variants_json")));
  if (!Array.isArray(variantsOrErr)) return { ok: false, message: variantsOrErr.error };

  const { data: existingImageRows } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId)
    .order("sort", { ascending: true });
  const existingPaths = (existingImageRows ?? []).map((i) => i.path as string);
const removedPaths = parseRemovedPaths(String(formData.get("removed_image_paths") ?? "")).filter(
  (p) => existingPaths.includes(p),
);
  const keptPaths = existingPaths.filter((p) => !removedPaths.includes(p));
  if (keptPaths.length + imagesOrErr.length > MAX_PRODUCT_IMAGES) {
    return {
      ok: false,
      message: `Products can have up to ${MAX_PRODUCT_IMAGES} images total. Remove some before adding more.`,
    };
  }

  const youtubeUrl = parsed.data.youtube_url?.trim() ? parsed.data.youtube_url.trim() : null;

  // Resolve the SEO image to one value BEFORE the single save below so the
  // product row always reflects the final choice (new / cleared / unchanged).
  let newSeoPath: string | null = null;
  if (seoChoice.seoFile) {
    try {
      newSeoPath = await uploadProductImage(supabase, user.id, productId, seoChoice.seoFile, "seo");
    } catch (err) {
      console.error("updateProduct seo upload failed:", err);
      return { ok: false, message: "Could not upload search image. No changes were saved.", productId };
    }
  }
  const oldSeoPath = existing.seo_image_path ?? null;
  const seoImagePath = newSeoPath ?? (seoClear ? null : oldSeoPath);

  const { error: updateError, data: updatedRows } = await supabase
    .from("products")
    .update({
      category_id: parsed.data.category_id,
      title: parsed.data.title.trim(),
      description: sanitizeRichText(parsed.data.description),
      hsn_code: parsed.data.hsn_code.trim(),
      gst_rate: parsed.data.gst_rate,
      carton_units: parsed.data.carton_units,
      carton_dimensions: parsed.data.carton_dimensions?.trim()
        ? parsed.data.carton_dimensions.trim()
        : null,
      carton_weight_kg: parsed.data.carton_weight_kg,
      unit: parsed.data.unit,
      price_per_unit: parsed.data.price_per_unit,
      negotiable: parsed.data.negotiable,
      is_winning: parsed.data.is_winning,
      is_hot_selling: parsed.data.is_hot_selling,
      packaging_details: parsed.data.packaging_details?.trim() ? parsed.data.packaging_details.trim() : null,
      warranty_return: parsed.data.warranty_return?.trim() ? parsed.data.warranty_return.trim() : null,
      youtube_url: youtubeUrl,
      youtube_id: youtubeUrl ? extractYoutubeId(youtubeUrl) : null,
      seo_title: seoText(parsed.data.seo_title) ?? defaultSeoTitle(parsed.data.title),
      seo_description: seoText(parsed.data.seo_description) ?? defaultSeoDescription(parsed.data.description),
      seo_image_path: seoImagePath,
    })
    .eq("id", productId)
    .select("id");
  if (updateError) {
    console.error("updateProduct failed:", updateError);
    if (updateError.code === "23505") {
      return { ok: false, message: "You already use this SKU on another product." };
    }
    if (newSeoPath) await removeStoredPaths(supabase, [newSeoPath]);
    return { ok: false, message: "Could not save. Try again." };
  }
  if (!updatedRows || updatedRows.length === 0) {
    if (newSeoPath) await removeStoredPaths(supabase, [newSeoPath]);
    return { ok: false, message: "Product not found." };
  }
  // The new value is persisted; the old stored file can be deleted now.
  if (oldSeoPath && oldSeoPath !== seoImagePath) {
    await removeStoredPaths(supabase, [oldSeoPath]);
  }

  // Cumulative image cap is enforced above; upload the new files before any
  // DB mutation so a failed upload leaves the product untouched.
  let newPaths: string[] = [];
  try {
    newPaths = await uploadImages(supabase, user.id, productId, imagesOrErr);
  } catch (err) {
    console.error("updateProduct image upload failed:", err);
    return { ok: false, message: "Product saved but image upload failed. Edit to retry.", productId };
  }

  const { error: imageRowsError } = await supabase.rpc("replace_product_images", {
    p_product_id: productId,
    p_paths: orderImagePaths(
      [...keptPaths, ...newPaths],
      resolvePrimaryImagePath(
        String(formData.get("primary_image") ?? ""),
        keptPaths,
        newPaths,
      ),
    ),
  });
  if (imageRowsError) {
    await removeStoredPaths(supabase, newPaths);
    console.error("updateProduct image rows failed:", imageRowsError);
    return { ok: false, message: rpcMessage(imageRowsError, "Cannot add that many images."), productId };
  }
  if (removedPaths.length > 0) {
    await removeStoredPaths(supabase, removedPaths);
  }

  const { error: variantsError } = await supabase.rpc("replace_product_variants", {
    p_product_id: productId,
    p_variants: variantRpcPayload(variantsOrErr),
  });
  if (variantsError) {
    console.error("updateProduct variants failed:", variantsError);
    return { ok: false, message: rpcMessage(variantsError, "Product saved but variant sync failed. Edit to retry."), productId };
  }

  await indexImagesForSearch(productId);

  revalidatePath("/supplier/dashboard/products");
  revalidateTag("products", "max");
  revalidateTag("prices", "max");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  if (boolOf(formData.get("auto_submit")) && existing.status !== "approved") {
    const res = await submitForApproval(supabase, supplierId, productId);
    if (!res.ok) return { ok: false, message: res.message, productId };
    revalidatePath("/admin/dashboard/products");
    return { ok: true, message: res.message, productId };
  }
  return { ok: true, message: "Saved.", productId };
}

export async function uploadProductImages(
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) return { ...initialState, message: "Missing product ID." };

  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ...initialState, message: "Only suppliers can list products." };

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) {
    return { ...initialState, message: "Product not found." };
  }

  const imagesOrErr = await collectImages(formData);
  if (!Array.isArray(imagesOrErr)) return { ok: false, message: imagesOrErr.error };

  const { data: existing } = await supabase
    .from("product_images")
    .select("path, sort")
    .eq("product_id", productId)
    .order("sort");

  const existingPaths = (existing ?? []).map((r) => r.path as string);

  let uploadedPaths: string[] = [];
  try {
    uploadedPaths = await uploadImages(supabase, user.id, productId, imagesOrErr);
  } catch (err) {
    console.error("uploadProductImages image upload failed:", err);
    await removeStoredPaths(supabase, uploadedPaths);
    return { ok: false, message: "Could not upload product images. Make sure the files are valid and try again." };
  }

  const allPaths = [...existingPaths, ...uploadedPaths];
  const { error: imageRowsError } = await supabase.rpc("replace_product_images", {
    p_product_id: productId,
    p_paths: orderImagePaths(
      allPaths,
      resolvePrimaryImagePath(String(formData.get("primary_image") ?? ""), [], uploadedPaths),
    ),
  });
  if (imageRowsError) {
    console.error("uploadProductImages image rows failed:", imageRowsError);
    await removeStoredPaths(supabase, uploadedPaths);
    return { ok: false, message: rpcMessage(imageRowsError, "Could not save product images. Try again.") };
  }

  await indexImagesForSearch(productId);
  revalidatePath(`/supplier/dashboard/products/${productId}/images`);
  revalidatePath("/supplier/dashboard/products");
  return { ok: true, message: "Images saved.", productId };
}

export async function checkSkuDuplicate(
  sku: string,
  excludeProductId?: string,
): Promise<{ duplicate: boolean }> {
  if (!sku.trim()) return { duplicate: false };
  const { supabase, user } = await requireUser();
  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { duplicate: false };
  let qb = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", supplierId)
    .eq("seller_sku", sku.trim().toUpperCase());
  if (excludeProductId) qb = qb.neq("id", excludeProductId);
  const { count } = await qb;
  return { duplicate: (count ?? 0) > 0 };
}

export async function saveProductAdditionalInfo(
  productId: string,
  _prev: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ...initialState, message: "Only suppliers can list products." };

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) {
    return { ...initialState, message: "Product not found." };
  }
  if (product.status !== "draft" && product.status !== "rejected" && product.status !== "approved") {
    return { ...initialState, message: "This product cannot be edited." };
  }

  const youtubeUrl = (formData.get("youtube_url") as string | null)?.trim() || null;
  const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
  if (youtubeUrl && !youtubeId) {
    return { ok: false, message: "Enter a valid YouTube link." };
  }

  const toNum = (v: FormDataEntryValue | null): number | null => {
    const s = v === null ? "" : String(v).trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const update: Record<string, unknown> = {
    carton_units: toNum(formData.get("carton_units")),
    carton_dimensions: nullIfEmpty(formData.get("carton_dimensions")),
    carton_weight_kg: toNum(formData.get("carton_weight_kg")),
    negotiable: formData.get("negotiable") === "on",
    is_winning: formData.get("is_winning") === "on",
    is_hot_selling: formData.get("is_hot_selling") === "on",
    packaging_details: nullIfEmpty(formData.get("packaging_details")),
    warranty_return: nullIfEmpty(formData.get("warranty_return")),
    youtube_url: youtubeUrl,
    youtube_id: youtubeId,
    seo_title: nullIfEmpty(formData.get("seo_title")),
    seo_description: nullIfEmpty(formData.get("seo_description")),
  };

  const { error: updateError } = await supabase
    .from("products")
    .update(update)
    .eq("id", productId)
    .eq("supplier_id", supplierId);
  if (updateError) {
    console.error("saveProductAdditionalInfo failed:", updateError);
    return { ok: false, message: "Could not save. Try again." };
  }

  // Variants
  const variantsJson = formData.get("variants_json");
  if (typeof variantsJson === "string" && variantsJson.trim() !== "") {
    const parsed = parseVariants(variantsJson);
    if (Array.isArray(parsed)) {
      const { error: vErr } = await supabase.rpc("replace_product_variants", {
        p_product_id: productId,
        p_variants: variantRpcPayload(parsed),
      });
      if (vErr) {
        console.error("saveProductAdditionalInfo variants failed:", vErr);
        return { ok: false, message: "Optional fields saved, but variants failed. Try again." };
      }
    }
  }

  revalidatePath(`/supplier/dashboard/products/${productId}/additional`);
  revalidatePath("/supplier/dashboard/products");
  return { ok: true, message: "Additional information saved.", productId };
}

export async function removeProductImage(
  productId: string,
  imagePath: string,
): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();
  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ...initialState, message: "Only suppliers can list products." };

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) {
    return { ...initialState, message: "Product not found." };
  }

  const { data: existing } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  const remaining = (existing ?? [])
    .map((r) => r.path as string)
    .filter((p) => p !== imagePath);

  const { error } = await supabase.rpc("replace_product_images", {
    p_product_id: productId,
    p_paths: remaining,
  });
  if (error) {
    console.error("removeProductImage failed:", error);
    return { ...initialState, message: "Could not remove image. Try again." };
  }

  // Best-effort storage cleanup.
  try {
    await supabase.storage.from("product_images").remove([imagePath]);
  } catch {
    // ignore
  }

  revalidatePath(`/supplier/dashboard/products/${productId}/images`);
  return { ok: true, message: "Image removed.", productId };
}

export async function setPrimaryImage(
  productId: string,
  imagePath: string,
): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();
  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ...initialState, message: "Only suppliers can list products." };

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) {
    return { ...initialState, message: "Product not found." };
  }

  const { data: existing } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  const paths = (existing ?? []).map((r) => r.path as string);
  if (!paths.includes(imagePath)) {
    return { ...initialState, message: "Image not found." };
  }

  const reordered = [imagePath, ...paths.filter((p) => p !== imagePath)];
  const { error } = await supabase.rpc("replace_product_images", {
    p_product_id: productId,
    p_paths: reordered,
  });
  if (error) {
    console.error("setPrimaryImage failed:", error);
    return { ...initialState, message: "Could not set primary image. Try again." };
  }

  revalidatePath(`/supplier/dashboard/products/${productId}/images`);
  return { ok: true, message: "Primary image updated.", productId };
}

export async function submitProduct(productId: string): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only suppliers can list products." };

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) {
    return { ok: false, message: "Product not found." };
  }
  if (product.status !== "draft" && product.status !== "rejected") {
    return { ok: false, message: "Only draft or returned products can be submitted." };
  }

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);
  if ((count ?? 0) < MIN_PRODUCT_IMAGES) {
    return { ok: false, message: `Add at least ${MIN_PRODUCT_IMAGES} images before submitting.` };
  }

  const { error } = await supabase.rpc("submit_product_for_approval", {
    p_product_id: productId,
  });
  if (error) {
    console.error("submitProduct failed:", error);
    return { ok: false, message: rpcMessage(error, "Could not submit. Try again.") };
  }
  revalidatePath("/supplier/dashboard/products");
  revalidatePath("/admin/dashboard/products");
  return { ok: true, message: "Published." };
}

export async function deleteProduct(productId: string): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only suppliers can list products." };

  const { data: images } = await supabase
    .from("product_images")
    .select("path")
    .eq("product_id", productId);
  const { error, data: deletedRows } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("supplier_id", supplierId)
    .in("status", ["draft", "rejected"])
    .select("id");
  if (error) {
    console.error("deleteProduct failed:", error);
    return { ok: false, message: "Could not delete. Try again." };
  }
  if (!deletedRows || deletedRows.length === 0) {
    return { ok: false, message: "Only draft or returned products can be deleted." };
  }
  if (images && images.length > 0) {
    await removeStoredPaths(
      supabase,
      images.map((i) => i.path as string),
    );
  }
  revalidatePath("/supplier/dashboard/products");
  return { ok: true, message: "Deleted." };
}

async function setHidden(productId: string, hidden: boolean): Promise<ProductActionState> {
  const { supabase, user } = await requireUser();

  const supplierId = await getVerifiedSupplierId(supabase, user.id);
  if (!supplierId) return { ok: false, message: "Only suppliers can manage products." };

  const { data: product } = await supabase
    .from("products")
    .select("id, supplier_id, status")
    .eq("id", productId)
    .maybeSingle();
  if (!product || product.supplier_id !== supplierId) {
    return { ok: false, message: "Product not found." };
  }
  if (product.status !== "approved") {
    return { ok: false, message: "Only live products can be hidden or shown." };
  }

  const { error } = await supabase
    .from("products")
    .update({ is_hidden: hidden })
    .eq("id", productId)
    .eq("supplier_id", supplierId)
    .eq("status", "approved");
  if (error) {
    console.error(`${hidden ? "hide" : "unhide"}Product failed:`, error);
    return { ok: false, message: "Could not update the listing. Try again." };
  }
  revalidatePath("/supplier/dashboard/products");
  revalidateTag("products", "max");
  revalidateTag("prices", "max");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return {
    ok: true,
    message: hidden ? "Listing hidden from the storefront." : "Listing is live again.",
  };
}

export async function hideProduct(productId: string): Promise<ProductActionState> {
  return setHidden(productId, true);
}

export async function unhideProduct(productId: string): Promise<ProductActionState> {
  return setHidden(productId, false);
}