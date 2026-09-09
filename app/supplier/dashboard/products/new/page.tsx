import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { ProductForm } from "../product-form";

export default async function NewSupplierProductPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const { data: company } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!company) redirect("/supplier/onboarding");
  if (company.kyb_status !== "verified") redirect("/supplier/dashboard");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent:parent_id(name)")
    .eq("is_active", true)
    .order("sort_order");

  const options = (categories ?? []).map((c) => {
    const parent = c.parent as { name: string } | { name: string }[] | null;
    return {
      id: c.id as string,
      name: c.name as string,
      parentName: Array.isArray(parent) ? (parent[0]?.name ?? null) : (parent?.name ?? null),
    };
  });

  return (
    <ProductForm
      mode="create"
      categories={options}
      title="New product"
      description="Save as draft, then submit for approval from the product list."
    />
  );
}
