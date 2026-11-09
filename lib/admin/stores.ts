"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guard";

export type StoreActionState = {
  ok: boolean;
  message: string;
};

const baseSchema = z.object({
  name: z.string().trim().min(2, "Give it a name of at least 2 characters."),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "store";
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  name: string,
  ignoreId?: string,
): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase
      .from("stores")
      .select("id", { head: true })
      .eq("slug", slug);
    if (ignoreId) {
      query = query.neq("id", ignoreId);
    }
    const { count } = await query;
    if (!count) {
      return slug;
    }
  }
  return `${base}-${Date.now()}`;
}

export async function getStoreSelectorItems(): Promise<{
  id: string;
  name: string;
  slug: string;
  status: string;
}[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, status")
    .order("name");
  return (data ?? []) as { id: string; name: string; slug: string; status: string }[];
}

export async function createStore(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = baseSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const slug = await uniqueSlug(supabase, parsed.data.name);

  const { error } = await supabase.from("stores").insert({
    name: parsed.data.name.trim(),
    slug,
    description: parsed.data.description?.trim() || null,
    status: parsed.data.status,
  });

  if (error) {
    console.error("createStore failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

const idSchema = z.object({
  id: z.string().uuid("Invalid store."),
});

export async function toggleStore(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid store." };
  }

  const { data: row } = await supabase
    .from("stores")
    .select("id, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Store not found." };
  }

  // Never deactivate the last active store — there must always be at least
  // one active store for storefront and dashboard operations.
  if (row.status === "active") {
    const { count } = await supabase
      .from("stores")
      .select("id", { head: true })
      .eq("status", "active");
    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        message: "Cannot deactivate the last active store.",
      };
    }
  }

  const { error } = await supabase
    .from("stores")
    .update({ status: row.status === "active" ? "inactive" : "active" })
    .eq("id", row.id);
  if (error) {
    console.error("toggleStore failed:", error);
    return { ok: false, message: "Could not update. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export async function updateStore(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { data: row } = await supabase
    .from("stores")
    .select("id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Store not found." };
  }

  const slug = await uniqueSlug(supabase, parsed.data.name, row.id);

  const { error } = await supabase
    .from("stores")
    .update({
      name: parsed.data.name.trim(),
      slug,
      description: parsed.data.description?.trim() || null,
      status: parsed.data.status,
    })
    .eq("id", row.id);
  if (error) {
    console.error("updateStore failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

// ---------------------------------------------------------------------------
// Store-product assignments ---------------------------------------------------
// ---------------------------------------------------------------------------

export type StoreProduct = {
  id: string;
  store_id: string;
  global_product_id: string;
  is_listed: boolean;
  created_at: string;
};

export async function getStoreProducts(storeId: string): Promise<StoreProduct[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_products")
    .select("id, store_id, global_product_id, is_listed, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  return (data ?? []) as StoreProduct[];
}

const storeProductSchema = z.object({
  store_id: z.string().uuid("Invalid store."),
  global_product_id: z.string().uuid("Invalid product."),
});

export async function assignStoreProduct(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = storeProductSchema.safeParse({
    store_id: formData.get("store_id"),
    global_product_id: formData.get("global_product_id"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  // Prevent duplicate assignments via the DB unique constraint; surface a
  // clear message instead of a 500.
  const { error } = await supabase.from("store_products").insert({
    store_id: parsed.data.store_id,
    global_product_id: parsed.data.global_product_id,
    is_listed: true,
  });

  if (error) {
    if (error.code === "23505") {
      // unique_violation on store_products_store_product_unique
      return {
        ok: false,
        message: "This product is already assigned to that store.",
      };
    }
    console.error("assignStoreProduct failed:", error);
    return { ok: false, message: "Could not assign product. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

const assignmentIdSchema = z.object({
  id: z.string().uuid("Invalid assignment."),
});

export async function toggleStoreProductListing(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = assignmentIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid assignment." };
  }

  const { data: row } = await supabase
    .from("store_products")
    .select("id, is_listed")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Assignment not found." };
  }

  const { error } = await supabase
    .from("store_products")
    .update({ is_listed: !row.is_listed })
    .eq("id", row.id);
  if (error) {
    console.error("toggleStoreProductListing failed:", error);
    return { ok: false, message: "Could not update. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

export async function deleteStoreProductAssignment(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = assignmentIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid assignment." };
  }

  const { error } = await supabase
    .from("store_products")
    .delete()
    .eq("id", parsed.data.id);
  if (error) {
    console.error("deleteStoreProductAssignment failed:", error);
    return { ok: false, message: "Could not delete. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

// ---------------------------------------------------------------------------
// Store product variants -------------------------------------------------------
// ---------------------------------------------------------------------------

export type StoreProductVariant = {
  id: string;
  store_product_id: string;
  variant_label: string;
  is_available: boolean;
  price_override: number | null;
  moq_override: number | null;
  stock_override: number;
  sort: number;
};

export async function getStoreProductVariants(
  storeProductId: string,
): Promise<StoreProductVariant[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_product_variants")
    .select(
      "id, store_product_id, variant_label, is_available, price_override, moq_override, stock_override, sort",
    )
    .eq("store_product_id", storeProductId)
    .order("sort")
    .order("id");
  return (data ?? []) as StoreProductVariant[];
}

const storeProductVariantSchema = z.object({
  store_product_id: z.string().uuid("Invalid store product."),
  variant_label: z.string().trim().min(1, "Variant label is required."),
  is_available: z.string().optional(),
  price_override: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val === "" ? null : Number(val)))
    .refine(
      (val) => val === null || (Number.isFinite(val) && val > 0),
      "Price must be greater than 0.",
    ),
  moq_override: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val === "" ? null : Number(val)))
    .refine(
      (val) => val === null || (Number.isFinite(val) && val >= 1),
      "MOQ must be at least 1.",
    ),
  stock_override: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val === "" ? "0" : val))
    .refine(
      (val) => Number.isFinite(Number(val)) && Number(val) >= 0,
      "Stock cannot be negative.",
    ),
  sort: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val === "" ? 0 : Number(val)))
    .refine(
      (val) => Number.isFinite(val),
      "Sort must be a number.",
    ),
});

export async function assignStoreProductVariant(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = storeProductVariantSchema.safeParse({
    store_product_id: formData.get("store_product_id"),
    variant_label: formData.get("variant_label"),
    is_available: formData.get("is_available"),
    price_override: formData.get("price_override"),
    moq_override: formData.get("moq_override"),
    stock_override: formData.get("stock_override"),
    sort: formData.get("sort"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { error } = await supabase.from("store_product_variants").insert({
    store_product_id: parsed.data.store_product_id,
    variant_label: parsed.data.variant_label,
    is_available: parsed.data.is_available !== "off",
    price_override: parsed.data.price_override,
    moq_override: parsed.data.moq_override,
    stock_override: parsed.data.stock_override
      ? Number(parsed.data.stock_override)
      : 0,
    sort: parsed.data.sort ?? 0,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "A variant with that label already exists for this store product.",
      };
    }
    console.error("assignStoreProductVariant failed:", error);
    return { ok: false, message: "Could not add variant. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

const variantIdSchema = z.object({
  id: z.string().uuid("Invalid variant."),
});

export async function toggleStoreProductVariant(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = variantIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid variant." };
  }

  const { data: row } = await supabase
    .from("store_product_variants")
    .select("id, is_available")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Variant not found." };
  }

  const { error } = await supabase
    .from("store_product_variants")
    .update({ is_available: !row.is_available })
    .eq("id", row.id);
  if (error) {
    console.error("toggleStoreProductVariant failed:", error);
    return { ok: false, message: "Could not update. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

export async function updateStoreProductVariant(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = storeProductVariantSchema
    .extend({ id: z.string().uuid() })
    .safeParse({
      id: formData.get("id"),
      store_product_id: formData.get("store_product_id"),
      variant_label: formData.get("variant_label"),
      is_available: formData.get("is_available"),
      price_override: formData.get("price_override"),
      moq_override: formData.get("moq_override"),
      stock_override: formData.get("stock_override"),
      sort: formData.get("sort"),
    });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { data: row } = await supabase
    .from("store_product_variants")
    .select("id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Variant not found." };
  }

  const { error } = await supabase
    .from("store_product_variants")
    .update({
      variant_label: parsed.data.variant_label,
      is_available: parsed.data.is_available !== "off",
      price_override: parsed.data.price_override,
      moq_override: parsed.data.moq_override,
      stock_override: parsed.data.stock_override
        ? Number(parsed.data.stock_override)
        : 0,
      sort: parsed.data.sort ?? 0,
    })
    .eq("id", row.id);
  if (error) {
    console.error("updateStoreProductVariant failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}

export async function deleteStoreProductVariant(
  _prevState: StoreActionState,
  formData: FormData,
): Promise<StoreActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = variantIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid variant." };
  }

  const { error } = await supabase
    .from("store_product_variants")
    .delete()
    .eq("id", parsed.data.id);
  if (error) {
    console.error("deleteStoreProductVariant failed:", error);
    return { ok: false, message: "Could not delete. Try again." };
  }

  revalidatePath("/admin/dashboard/stores");
  revalidatePath("/admin/dashboard");
  redirect("/admin/dashboard/stores");
}
