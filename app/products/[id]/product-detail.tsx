"use client";

import { useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ShieldCheckIcon,
  Location01Icon,
  PinLocation01Icon,
} from "@hugeicons/core-free-icons";
import { publicImageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { SectionHeader } from "@/components/storefront/section-header";

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

type Product = {
  id: string;
  title: string;
  description: string;
  brand: string | null;
  seller_sku: string;
  hsn_code: string;
  unit: string;
  price_per_unit: number;
  moq: number;
  stock_qty: number;
  price_slabs: { min_qty: number; price: number }[];
  negotiable: boolean;
  sample_available: boolean;
  sample_price: number | null;
  lead_time_days: number;
  gst_rate: number | null;
  attributes: Record<string, string>;
  certifications: string[];
  packaging_details: string | null;
  warranty_return: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  created_at: string;
  category: { id: string; name: string; slug: string } | null;
  supplier: { id: string; business_name: string; city: string; state: string; logo_path: string | null } | null;
  images: { id: string; path: string; sort: number; alt: string | null }[];
  variants: { id: string; label: string; attrs: Record<string, string>; seller_sku: string; price: number; moq: number | null; stock_qty: number; sort: number }[];
};

function SpecItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

export function ProductDetail({
  product,
  related,
}: {
  product: Product;
  related?: ProductCardData[];
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState("description");
  const images = [...product.images].sort((a, b) => a.sort - b.sort);
  const sortedVariants = [...product.variants].sort((a, b) => a.sort - b.sort);
  const supplier = product.supplier;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(product.category
            ? [{ label: product.category.name, href: `/category/${product.category.slug}` }]
            : []),
          { label: product.title },
        ]}
      />

      {/* Main content: image + transactional sidebar */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        {/* Image gallery */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-card">
            {images.length > 0 ? (
              <Image
                src={publicImageUrl("product_images", images[activeImage].path)}
                alt={images[activeImage].alt ?? product.title}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No image
              </div>
            )}
            {product.negotiable && (
              <span className="absolute left-3 top-3 rounded-sm bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                Negotiable
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                  aria-current={i === activeImage}
                  className={`relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted ${
                    i === activeImage
                      ? "border-primary"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <Image
                    src={publicImageUrl("product_images", img.path)}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Transactional info column */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              {product.title}
            </h1>
            {product.brand && (
              <p className="mt-1 text-sm text-muted-foreground">
                Brand: <span className="font-medium text-foreground">{product.brand}</span>
              </p>
            )}
            {product.certifications.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {product.certifications.map((cert) => (
                  <Badge key={cert} variant="success">
                    {cert}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Price + MOQ card */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl font-bold tracking-tight text-foreground">
                {formatPrice(product.price_per_unit)}
              </span>
              <span className="text-sm text-muted-foreground">
                / {product.unit}
              </span>
              {product.negotiable && (
                <Button variant="outline" size="xs" className="ml-auto rounded-sm border-brand-amber/60 text-brand-dark dark:text-brand-amber">
                  Price Negotiable
                </Button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Minimum Order
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {product.moq} {product.unit}
                  {product.moq > 1 ? "s" : ""}
                </p>
              </div>
              <div className="rounded-md bg-primary/5 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Sample
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {product.sample_available
                    ? product.sample_price
                      ? formatPrice(product.sample_price)
                      : "Available"
                    : "Not available"}
                </p>
              </div>
            </div>
          </div>

          {/* Quantity pricing */}
          {product.price_slabs.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <p className="border-b border-border px-4 py-2.5 text-sm font-semibold">
                Quantity Pricing
              </p>
              <Table>
                <TableBody>
                  {[...product.price_slabs]
                    .sort((a, b) => a.min_qty - b.min_qty)
                    .map((slab, i) => (
                      <TableRow key={i} className="border-b-0 hover:bg-transparent">
                        <TableCell className="text-sm text-muted-foreground">
                          {slab.min_qty}+ {product.unit}s
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums text-foreground">
                          {formatPrice(slab.price)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            / {product.unit}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Quick specs */}
          <div className="grid grid-cols-2 gap-2">
            <SpecItem
              label="Stock"
              value={
                product.stock_qty > 0
                  ? `${product.stock_qty} in stock`
                  : "Out of stock"
              }
            />
            <SpecItem label="Lead time" value={`${product.lead_time_days} days`} />
            <SpecItem
              label="GST rate"
              value={`${product.gst_rate ?? 0}%`}
            />
            <SpecItem label="HSN code" value={product.hsn_code} />
          </div>

          {/* Supplier card */}
          {supplier && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                {supplier.logo_path ? (
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    <Image
                      src={publicImageUrl("company_logos", supplier.logo_path)}
                      alt={supplier.business_name}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                    {supplier.business_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold">
                      {supplier.business_name}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-success/10 px-1 py-0.5 text-[11px] font-semibold text-success">
                      <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-3" />
                      Verified
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3 shrink-0" />
                    {supplier.city}, {supplier.state}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Buy / enquiry actions */}
          <div className="flex flex-col gap-2">
            <Button size="lg" className="h-11 w-full text-base font-semibold">
              Send Enquiry
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="default" className="border-border bg-card">
                Request Quote
              </Button>
              <Button variant="outline" size="default" className="border-border bg-card">
                Contact Supplier
              </Button>
            </div>
            {supplier && (
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <HugeiconsIcon icon={PinLocation01Icon} strokeWidth={2} className="size-3.5" />
                Ships from {supplier.city}, {supplier.state}
              </p>
            )}
          </div>

          {/* Description / specifications / variants */}
          <div className="w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="description">Description</TabsTrigger>
                {Object.keys(product.attributes).length > 0 && (
                  <TabsTrigger value="specifications">Specifications</TabsTrigger>
                )}
                {sortedVariants.length > 0 && (
                  <TabsTrigger value="variants">Variants</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="description" className="mt-4">
                <Card className="rounded-lg p-6">
                  <div className="prose prose-sm max-w-none text-sm">
                    <p className="whitespace-pre-wrap">{product.description}</p>
                  </div>
                  {product.packaging_details && (
                    <div className="mt-5">
                      <p className="text-sm font-semibold">Packaging Details</p>
                      <p className="mt-1 text-sm text-muted-foreground">{product.packaging_details}</p>
                    </div>
                  )}
                  {product.warranty_return && (
                    <div className="mt-5">
                      <p className="text-sm font-semibold">Warranty & Returns</p>
                      <p className="mt-1 text-sm text-muted-foreground">{product.warranty_return}</p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {Object.keys(product.attributes).length > 0 && (
                <TabsContent value="specifications" className="mt-4">
                  <Card className="rounded-lg p-6">
                    <Table>
                      <TableBody>
                        {Object.entries(product.attributes).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableHead className="w-40 font-medium">{key}</TableHead>
                            <TableCell>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>
              )}

              {sortedVariants.length > 0 && (
                <TabsContent value="variants" className="mt-4">
                  <Card className="rounded-lg p-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variant</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>MOQ</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>SKU</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedVariants.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell className="font-medium">{v.label}</TableCell>
                            <TableCell className="font-semibold">{formatPrice(v.price)}</TableCell>
                            <TableCell>{v.moq ?? product.moq}+</TableCell>
                            <TableCell>{v.stock_qty}</TableCell>
                            <TableCell className="text-muted-foreground">{v.seller_sku}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>

      {/* Related products */}
      {related && related.length > 0 && (
        <div className="mt-10">
          <SectionHeader
            title="Related Products"
            subtitle="More from this category"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {related.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}