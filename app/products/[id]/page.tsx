import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getProduct,
  getRelatedProducts,
  getNavigationCategories,
} from "@/lib/storefront";
import { StorefrontHeader } from "@/components/layout/storefront-header";
import { StorefrontFooter } from "@/components/layout/storefront-footer";
import { ProductDetail } from "./product-detail";

function getRootCategoryId(product: unknown): string | null {
  const p = product as { category?: unknown };
  if (!p.category) return null;
  if (Array.isArray(p.category)) {
    const first = p.category[0] as { id?: string } | undefined;
    return first?.id ?? null;
  }
  return (p.category as { id?: string }).id ?? null;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userType: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();
    userType = profile?.user_type ?? null;
  }

  const product = await getProduct(supabase, id);
  if (!product) notFound();

  const catId = getRootCategoryId(product);
  const [navCategories, related] = await Promise.all([
    getNavigationCategories(supabase),
    catId ? getRelatedProducts(supabase, catId, id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader
        user={user ? { email: user.email!, user_type: userType ?? "buyer" } : null}
        categories={navCategories}
      />
      <main className="flex-1 bg-background">
        <ProductDetail product={product as never} related={related as never} />
      </main>
      <StorefrontFooter />
    </div>
  );
}