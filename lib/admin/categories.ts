"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";

export type CategoryActionState = {
  ok: boolean;
  message: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const baseSchema = z.object({
  name: z.string().trim().min(2, "Give it a name of at least 2 characters."),
  parent_id: z
    .string()
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      "Pick a valid parent category.",
    )
    .optional()
    .or(z.literal("")),
  is_active: z.string().optional(),
});

function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category";
  return base;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "admin") {
    redirect("/");
  }

  return supabase;
}

function validateImage(file: File | null, required: boolean): string | null {
  if (!file || file.size === 0) {
    return required ? "An image is required." : null;
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Only JPG, PNG or WEBP images are allowed.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be under 5 MB.";
  }
  return null;
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  parentId: string | null,
  ignoreId?: string,
): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase
      .from("categories")
      .select("id", { head: true })
      .eq("slug", slug);
    query = parentId
      ? query.eq("parent_id", parentId)
      : query.is("parent_id", null);
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

async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${categoryId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("category_images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error("Could not upload the image. Try again.");
  }
  return path;
}

export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState | never> {
  const supabase = await requireAdmin();
  const parsed = baseSchema.safeParse({
    name: formData.get("name"),
    parent_id: formData.get("parent_id") ?? "",
    is_active: formData.get("is_active") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const value = formData.get("image");
  const file = value instanceof File && value.size > 0 ? value : null;
  const fileError = validateImage(file, true);
  if (fileError || !file) {
    return { ok: false, message: fileError ?? "An image is required." };
  }

  const parentId = parsed.data.parent_id ? parsed.data.parent_id : null;
  if (parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.parent_id) {
      return { ok: false, message: "Pick a valid parent category." };
    }
  }

  const slug = await uniqueSlug(supabase, parsed.data.name, parentId);

  const { data: row, error: insertError } = await supabase
    .from("categories")
    .insert({
      name: parsed.data.name.trim(),
      slug,
      parent_id: parentId,
      image_path: "pending",
      is_active: parsed.data.is_active !== "off",
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("createCategory failed:", insertError);
    return { ok: false, message: "Could not save. Try again." };
  }

  try {
    const path = await uploadImage(supabase, row.id, file);
    const { error: pathError } = await supabase
      .from("categories")
      .update({ image_path: path })
      .eq("id", row.id);
    if (pathError) {
      throw pathError;
    }
  } catch (err) {
    console.error("createCategory image failed:", err);
    await supabase.from("categories").delete().eq("id", row.id);
    return { ok: false, message: "Could not upload the image. Try again." };
  }

  revalidatePath("/admin/dashboard/categories");
  redirect("/admin/dashboard/categories");
}

const idSchema = z.object({
  id: z.string().uuid("Invalid category."),
});

export async function toggleCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState | never> {
  const supabase = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid category." };
  }

  const { data: row } = await supabase
    .from("categories")
    .select("id, is_active")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Category not found." };
  }

  const { error } = await supabase
    .from("categories")
    .update({ is_active: !row.is_active })
    .eq("id", row.id);
  if (error) {
    console.error("toggleCategory failed:", error);
    return { ok: false, message: "Could not update. Try again." };
  }

  revalidatePath("/admin/dashboard/categories");
  redirect("/admin/dashboard/categories");
}

export async function deleteCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState | never> {
  const supabase = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid category." };
  }

  const { count: children } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("parent_id", parsed.data.id);
  if (children && children > 0) {
    return {
      ok: false,
      message: "Remove its subcategories first, then delete this category.",
    };
  }

  const { data: row } = await supabase
    .from("categories")
    .select("id, image_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Category not found." };
  }

  const { error } = await supabase.from("categories").delete().eq("id", row.id);
  if (error) {
    console.error("deleteCategory failed:", error);
    return { ok: false, message: "Could not delete. Try again." };
  }
  if (row.image_path && row.image_path !== "pending") {
    await supabase.storage.from("category_images").remove([row.image_path]);
  }

  revalidatePath("/admin/dashboard/categories");
  redirect("/admin/dashboard/categories");
}

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export async function updateCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState | never> {
  const supabase = await requireAdmin();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    parent_id: formData.get("parent_id") ?? "",
    is_active: formData.get("is_active") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const value = formData.get("image");
  const file = value instanceof File && value.size > 0 ? value : null;
  const fileError = validateImage(file, false);
  if (fileError) {
    return { ok: false, message: fileError };
  }

  const { data: row } = await supabase
    .from("categories")
    .select("id, parent_id, image_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Category not found." };
  }

  // Parent can only change between top-level and one valid parent;
  // a category with children must stay top-level.
  const parentId = parsed.data.parent_id ? parsed.data.parent_id : null;
  if (parentId === row.id) {
    return { ok: false, message: "A category cannot be its own parent." };
  }
  if (parentId) {
    const { data: parent } = await supabase
      .from("categories")
      .select("id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.parent_id) {
      return { ok: false, message: "Pick a valid parent category." };
    }
    const { count: children } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", row.id);
    if (children && children > 0) {
      return {
        ok: false,
        message: "Move its subcategories elsewhere first.",
      };
    }
  }

  const slug = await uniqueSlug(supabase, parsed.data.name, parentId, row.id);

  let imagePath = row.image_path;
  if (file) {
    try {
      imagePath = await uploadImage(supabase, row.id, file);
    } catch (err) {
      console.error("updateCategory image failed:", err);
      return { ok: false, message: "Could not upload the image. Try again." };
    }
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name.trim(),
      slug,
      parent_id: parentId,
      image_path: imagePath,
      is_active: parsed.data.is_active !== "off",
    })
    .eq("id", row.id);
  if (error) {
    console.error("updateCategory failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  revalidatePath("/admin/dashboard/categories");
  redirect("/admin/dashboard/categories");
}
