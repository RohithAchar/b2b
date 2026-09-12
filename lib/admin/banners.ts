"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { BANNER_SLOTS } from "./banner-slots";

export type BannerActionState = {
  ok: boolean;
  message: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const linkUrlSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") return true;
      if (value.startsWith("/")) return true;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    "Link must be an absolute http(s) URL or an internal path starting with /.",
  )
  .optional()
  .or(z.literal(""));

const baseSchema = z.object({
  slot: z.enum(BANNER_SLOTS),
  title: z
    .string()
    .trim()
    .max(80, "Keep the title under 80 characters.")
    .optional(),
  subtitle: z
    .string()
    .trim()
    .max(160, "Keep the subtitle under 160 characters.")
    .optional(),
  link_url: linkUrlSchema,
});

function normalizeInput(formData: FormData) {
  return {
    slot: formData.get("slot") ?? "",
    title: formData.get("title") ?? "",
    subtitle: formData.get("subtitle") ?? "",
    link_url: formData.get("link_url") ?? "",
  };
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

async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bannerId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${bannerId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("banners")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error("Could not upload the image. Try again.");
  }
  return path;
}

function revalidateBanners() {
  revalidatePath("/admin/dashboard/banners");
  revalidatePath("/");
}

export async function createBanner(
  _prevState: BannerActionState,
  formData: FormData,
): Promise<BannerActionState | never> {
  const supabase = await requireAdmin();
  const parsed = baseSchema.safeParse(normalizeInput(formData));
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

  const { data: row, error: insertError } = await supabase
    .from("home_banners")
    .insert({
      slot: parsed.data.slot,
      title: parsed.data.title?.trim() || null,
      subtitle: parsed.data.subtitle?.trim() || null,
      link_url: parsed.data.link_url?.trim() || null,
      image_path: "pending",
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("createBanner failed:", insertError);
    return { ok: false, message: "Could not save. Try again." };
  }

  try {
    const path = await uploadImage(supabase, row.id, file);
    const { error: pathError } = await supabase
      .from("home_banners")
      .update({ image_path: path })
      .eq("id", row.id);
    if (pathError) {
      throw pathError;
    }
  } catch (err) {
    console.error("createBanner image failed:", err);
    await supabase.from("home_banners").delete().eq("id", row.id);
    return { ok: false, message: "Could not upload the image. Try again." };
  }

  revalidateBanners();
  redirect("/admin/dashboard/banners");
}

const idSchema = z.object({
  id: z.string().uuid("Invalid banner."),
});

export async function toggleBanner(
  _prevState: BannerActionState,
  formData: FormData,
): Promise<BannerActionState | never> {
  const supabase = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid banner." };
  }

  const { data: row } = await supabase
    .from("home_banners")
    .select("id, is_active")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Banner not found." };
  }

  const { error } = await supabase
    .from("home_banners")
    .update({ is_active: !row.is_active })
    .eq("id", row.id);
  if (error) {
    console.error("toggleBanner failed:", error);
    return { ok: false, message: "Could not update. Try again." };
  }

  revalidateBanners();
  redirect("/admin/dashboard/banners");
}

export async function deleteBanner(
  _prevState: BannerActionState,
  formData: FormData,
): Promise<BannerActionState | never> {
  const supabase = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid banner." };
  }

  const { data: row } = await supabase
    .from("home_banners")
    .select("id, image_path")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Banner not found." };
  }

  const { error } = await supabase.from("home_banners").delete().eq("id", row.id);
  if (error) {
    console.error("deleteBanner failed:", error);
    return { ok: false, message: "Could not delete. Try again." };
  }
  if (row.image_path && row.image_path !== "pending") {
    await supabase.storage.from("banners").remove([row.image_path]);
  }

  revalidateBanners();
  redirect("/admin/dashboard/banners");
}

const updateSchema = baseSchema.extend({ id: z.string().uuid() });

export async function updateBanner(
  _prevState: BannerActionState,
  formData: FormData,
): Promise<BannerActionState | never> {
  const supabase = await requireAdmin();
  const parsed = updateSchema.safeParse({
    ...normalizeInput(formData),
    id: formData.get("id"),
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
    .from("home_banners")
    .select("id, image_path, is_active")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!row) {
    return { ok: false, message: "Banner not found." };
  }

  let imagePath = row.image_path;
  let oldImagePath: string | null = null;
  if (file) {
    try {
      imagePath = await uploadImage(supabase, row.id, file);
      oldImagePath = row.image_path;
    } catch (err) {
      console.error("updateBanner image failed:", err);
      return { ok: false, message: "Could not upload the image. Try again." };
    }
  }

  const { error } = await supabase
    .from("home_banners")
    .update({
      slot: parsed.data.slot,
      title: parsed.data.title?.trim() || null,
      subtitle: parsed.data.subtitle?.trim() || null,
      link_url: parsed.data.link_url?.trim() || null,
      image_path: imagePath,
      is_active: row.is_active,
    })
    .eq("id", row.id);

  if (error) {
    console.error("updateBanner failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  if (oldImagePath && oldImagePath !== "pending") {
    await supabase.storage.from("banners").remove([oldImagePath]);
  }

  revalidateBanners();
  redirect("/admin/dashboard/banners");
}