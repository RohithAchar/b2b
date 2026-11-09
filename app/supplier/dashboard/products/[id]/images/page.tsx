import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { getSupplierContext } from "@/lib/auth/guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { uploadProductImages, submitProduct } from "@/lib/supplier/product-actions";
import { ProductWizardSteps } from "@/components/supplier/product-wizard-steps";
import { ProductImagesForm } from "./images-form";

export default async function ProductImagesPage({
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
    .select("id, title, status, supplier_id")
    .eq("id", id)
    .eq("supplier_id", companyId)
    .maybeSingle();
  if (!product) notFound();

  const { data: images } = await supabase
    .from("product_images")
    .select("id, path, sort")
    .eq("product_id", id)
    .order("sort");

  const imageCount = (images ?? []).length;

  return (
    <div className="mx-auto w-full max-w-3xl p-6">
      <div className="mb-4">
        <Link href="/supplier/dashboard/products" className="text-sm text-muted-foreground hover:underline">
          ← Back to products
        </Link>
      </div>
      <ProductWizardSteps productId={id} currentStep={2} />
      <Card>
        <CardHeader>
          <CardTitle>Add images</CardTitle>
          <CardDescription>
            Upload at least 3 images for “{product.title}” before submitting for
            approval. You can add up to 8 images.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {product.status === "approved" ? (
            <Alert>
              <AlertTitle>Already published</AlertTitle>
              <AlertDescription>
                This product is live. Editing images will update the listing.
              </AlertDescription>
            </Alert>
          ) : null}

          <ProductImagesForm
            productId={id}
            productTitle={product.title}
            existingImages={(images ?? []).map((img) => ({
              id: img.id as string,
              path: img.path as string,
            }))}
            imageCount={imageCount}
            canSubmit={imageCount >= 3}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              render={<Link href={`/supplier/dashboard/products/${id}/additional`} />}
              variant="outline"
              nativeButton={false}
            >
              Continue to additional info
            </Button>
            <Button
              render={<Link href="/supplier/dashboard/products" />}
              variant="outline"
              nativeButton={false}
            >
              Back to products
            </Button>
            {product.status !== "approved" && imageCount >= 3 ? (
              <form action={async () => { await submitProduct(id); }}>
                <Button type="submit">Submit for approval</Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
