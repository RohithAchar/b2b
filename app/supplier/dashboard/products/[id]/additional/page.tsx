import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductWizardSteps } from "@/components/supplier/product-wizard-steps";
import { AdditionalInfoForm } from "./additional-form";

export default async function ProductAdditionalInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect(LOGIN_PATH);

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx) redirect("/supplier/onboarding");
  const companyId = ctx.companyId;

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, category_id, seller_sku, hsn_code, gst_rate, carton_units, carton_dimensions, carton_weight_kg, description, unit, negotiable, is_winning, is_hot_selling, packaging_details, warranty_return, youtube_url, seo_title, seo_description, status, supplier_id",
    )
    .eq("id", id)
    .eq("supplier_id", companyId)
    .maybeSingle();
  if (!product) notFound();

  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, label, attrs, seller_sku, price, moq, stock_qty, sort")
    .eq("product_id", id)
    .order("sort");

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <ProductWizardSteps productId={id} currentStep={3} />
      <Card>
        <CardHeader>
          <CardTitle>Additional information</CardTitle>
          <CardDescription>
            Optional details for “{product.title}”. You can skip any field and
            save; the product stays a draft.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AdditionalInfoForm
            productId={id}
            product={product}
            variants={variants ?? []}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              render={<Link href={`/supplier/dashboard/products/${id}/images`} />}
              variant="outline"
              nativeButton={false}
            >
              Back to images
            </Button>
            <Button
              render={<Link href="/supplier/dashboard/products" />}
              variant="outline"
              nativeButton={false}
            >
              Back to products
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
