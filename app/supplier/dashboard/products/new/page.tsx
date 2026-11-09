import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { ProductForm } from "../product-form";

export default async function NewSupplierProductPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect(LOGIN_PATH);

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) redirect("/supplier/onboarding");
  if (!ctx.verified) redirect("/supplier/dashboard");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");

  // Products created from the core dashboard belong to D2H Core.
  const { data: coreStore } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", "d2h-core")
    .maybeSingle();

  const options = (categories ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));

  return (
    <ProductForm
      mode="create"
      categories={options}
      title="Add new product"
      description="Save as draft, or publish directly to your storefront."
      storeId={coreStore?.id as string | undefined}
    />
  );
}
