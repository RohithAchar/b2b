"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
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
  const { createClient } = await import("@/lib/supabase/server");
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
