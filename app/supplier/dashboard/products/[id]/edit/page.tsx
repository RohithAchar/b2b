import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductForm, type ExistingProduct } from "../../product-form";

export default async function EditSupplierProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, category_id, brand, seller_sku, hsn_code, description, unit, price_per_unit, moq, stock_qty, negotiable, sample_available, sample_price, lead_time_days, gst_rate, packaging_details, warranty_return, youtube_url, seo_title, seo_description, seo_image_path, status, is_hidden",
    )
    .eq("id", id)
    .eq("supplier_id", company.id)
    .maybeSingle();
  if (!product) notFound();

  if (product.status === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pt-8">
        <Alert>
          <AlertTitle>Under review</AlertTitle>
          <AlertDescription>
            “{product.title}” is being reviewed and cannot be edited right now.
            If anything needs fixing, it will come back with a note.
          </AlertDescription>
        </Alert>
        <div>
          <Button render={<Link href="/supplier/dashboard/products" />} variant="outline">
            Back to products
          </Button>
        </div>
      </div>
    );
  }

  const { data: images } = await supabase
    .from("product_images")
    .select("id, path")
    .eq("product_id", id)
    .order("sort");
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, label, attrs, seller_sku, price, moq, stock_qty")
    .eq("product_id", id)
    .order("sort");

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent:parent_id(name)")
    .eq("is_active", true)
    .order("sort_order");

  const existing: ExistingProduct = {
    id: product.id,
    title: product.title,
    category_id: product.category_id,
    brand: product.brand,
    seller_sku: product.seller_sku,
    hsn_code: product.hsn_code,
    description: product.description,
    unit: product.unit,
    price_per_unit: Number(product.price_per_unit),
    moq: product.moq,
    stock_qty: product.stock_qty,
    negotiable: product.negotiable,
    sample_available: product.sample_available,
    sample_price: product.sample_price != null ? Number(product.sample_price) : null,
    lead_time_days: product.lead_time_days,
    gst_rate: product.gst_rate != null ? Number(product.gst_rate) : null,
    packaging_details: product.packaging_details,
    warranty_return: product.warranty_return,
    youtube_url: product.youtube_url,
    seo_title: product.seo_title,
    seo_description: product.seo_description,
    seo_image_path: product.seo_image_path,
    status: product.status,
    images: images ?? [],
    variants: (variants ?? []).map((v) => {
      const attrs = (v.attrs ?? {}) as Record<string, string>;
      const entries = Object.entries(attrs);
      return {
        id: v.id,
        label: v.label,
        attr_key: entries[0]?.[0] ?? "",
        attr_value: entries[0]?.[1] ?? "",
        seller_sku: v.seller_sku,
        price: Number(v.price),
        moq: v.moq,
        stock_qty: v.stock_qty,
      };
    }),
  };

  return (
    <ProductForm
      mode="edit"
      product={existing}
      categories={(categories ?? []).map((c) => {
        const parent = c.parent as { name: string } | { name: string }[] | null;
        return {
          id: c.id as string,
          name: c.name as string,
          parentName: Array.isArray(parent) ? (parent[0]?.name ?? null) : (parent?.name ?? null),
        };
      })}
      title="Edit product"
      description={
        product.status === "approved"
          ? product.is_hidden
            ? "This listing is hidden from the storefront. Changes save instantly and it stays hidden."
            : "Changes go live immediately."
          : "Edits save instantly. Submit for review when you are ready to publish."
      }
    />
  );
}
