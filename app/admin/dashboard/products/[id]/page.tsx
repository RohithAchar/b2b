import Link from "next/link";
import { notFound } from "next/navigation";
import { stripHtml } from "@/lib/supplier/rich-text";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { youtubeThumbUrl } from "@/lib/supplier/products";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ProductDecisionForm } from "./decision-form";

function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product_images/${path}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{value}</ItemTitle>
        <ItemDescription>{label}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

export default async function AdminProductReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, description, brand, seller_sku, hsn_code, unit, price_per_unit, moq, stock_qty, negotiable, sample_available, sample_price, lead_time_days, gst_rate, attributes, certifications, packaging_details, warranty_return, youtube_url, youtube_id, status, is_hidden, rejection_note, supplier:supplier_id(business_name, city, state)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const { data: images } = await supabase
    .from("product_images")
    .select("id, path, sort")
    .eq("product_id", id)
    .order("sort");
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, label, attrs, seller_sku, price, moq, stock_qty")
    .eq("product_id", id)
    .order("sort");

  const rawSupplier = product.supplier as
    | { business_name: string; city: string; state: string }
    | { business_name: string; city: string; state: string }[]
    | null;
  const supplier = Array.isArray(rawSupplier)
    ? (rawSupplier[0] ?? null)
    : rawSupplier;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/admin/dashboard/products" />}>
              Product approvals
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Card>
      <CardHeader>
        <CardTitle>{product.title}</CardTitle>
        <CardDescription>
          {supplier?.business_name ?? "—"} — {supplier?.city ?? ""},{" "}
          {supplier?.state ?? ""} — ₹{Number(product.price_per_unit)} /{" "}
          {product.unit} — MOQ {product.moq}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <StatusBadge status="product" value={product.status} />
            {product.status === "approved" && product.is_hidden ? (
              <Badge variant="outline" className="text-muted-foreground">
                Hidden by supplier
              </Badge>
            ) : null}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Status</FieldLabel>
            <StatusBadge status="product" value={product.status} />
            {product.rejection_note ? (
              <FieldDescription>{product.rejection_note}</FieldDescription>
            ) : null}
          </Field>
          <Separator />
          <Field>
            <FieldLabel>Description</FieldLabel>
            <FieldDescription>{stripHtml(product.description)}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Facts</FieldLabel>
            <ItemGroup>
              <Fact label="Seller SKU" value={product.seller_sku || "—"} />
              <Fact label="HSN code" value={product.hsn_code || "—"} />
              <Fact label="Brand" value={product.brand ?? "—"} />
              <Fact label="Stock" value={String(product.stock_qty)} />
              <Fact
                label="Lead time"
                value={`${product.lead_time_days ?? "—"} days`}
              />
              <Fact
                label="GST rate"
                value={product.gst_rate != null ? `${product.gst_rate}%` : "—"}
              />
              <Fact
                label="Negotiable"
                value={product.negotiable ? "Yes" : "No"}
              />
              <Fact
                label="Sample"
                value={
                  product.sample_available
                    ? `Yes${product.sample_price ? ` — ₹${Number(product.sample_price)}` : ""}`
                    : "No"
                }
              />
            </ItemGroup>
          </Field>
          <Field>
            <FieldLabel>Images ({images?.length ?? 0})</FieldLabel>
            <ItemGroup>
              {(images ?? []).map((img, i) => (
                <Item key={img.id} variant="outline">
                  <ItemContent>
                    <AspectRatio ratio={16 / 9}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(img.path)} alt="" />
                    </AspectRatio>
                    <ItemDescription>{i === 0 ? "Cover" : `Image ${i + 1}`}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </Field>
          {product.youtube_id ? (
            <Field>
              <FieldLabel>Video</FieldLabel>
              <AspectRatio ratio={16 / 9}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={youtubeThumbUrl(product.youtube_id)} alt="Video thumbnail" />
              </AspectRatio>
              <FieldDescription>{product.youtube_url}</FieldDescription>
            </Field>
          ) : null}
          {(variants?.length ?? 0) > 0 ? (
            <Field>
              <FieldLabel>Variants ({variants?.length})</FieldLabel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Price ₹</TableHead>
                    <TableHead>MOQ</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(variants ?? []).map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>{v.label}</TableCell>
                      <TableCell>{v.seller_sku}</TableCell>
                      <TableCell>{Number(v.price)}</TableCell>
                      <TableCell>{v.moq ?? "base"}</TableCell>
                      <TableCell>{v.stock_qty}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Field>
          ) : null}
          <Separator />
          <ProductDecisionForm productId={product.id} status={product.status ?? "draft"} />
        </FieldGroup>
      </CardContent>
    </Card>
    </div>
  );
}
