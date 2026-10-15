import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const now = new Date();

  const [{ data: products }, { data: categories }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select("id")
      .eq("status", "approved")
      .eq("is_hidden", false)
      .limit(PAGE_SIZE),
    supabase.from("categories").select("slug").limit(500),
    supabase.from("storefront_suppliers").select("id").limit(1000),
  ]);

  return [
    { url: "/", lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: "/products", lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: "/categories", lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...((categories ?? []) as { slug: string }[]).map((category) => ({
      url: `/category/${category.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...((products ?? []) as { id: string }[]).map((product) => ({
      url: `/products/${product.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...((suppliers ?? []) as { id: string }[]).map((supplier) => ({
      url: `/store/${supplier.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
