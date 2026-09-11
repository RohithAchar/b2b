"use client";

import { useState } from "react";
import Link from "next/link";
import { publicImageUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

export function ProductDetail({ product }: { product: Product }) {
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState("description");
  const images = [...product.images].sort((a, b) => a.sort - b.sort);
  const sortedVariants = [...product.variants].sort((a, b) => a.sort - b.sort);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1">/</span>
        {product.category && (
          <>
            <Link href={`/category/${product.category.slug}`} className="hover:text-foreground">
              {product.category.name}
            </Link>
            <span className="mx-1">/</span>
          </>
        )}
        <span className="text-foreground">{product.title}</span>
      </nav>

      {/* Main content: image + info */}
      <div className="grid gap-6 md:grid-cols-[1fr_400px]">
        {/* Image gallery */}
        <div>
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted">
            {images.length > 0 ? (
              <img
                src={publicImageUrl("product_images", images[activeImage].path)}
                alt={images[activeImage].alt ?? product.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No image
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted ${
                    i === activeImage ? "border-foreground" : "border-transparent"
                  }`}
                >
                  <img
                    src={publicImageUrl("product_images", img.path)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">{product.title}</h1>

          {product.brand && (
            <p className="text-sm text-muted-foreground">Brand: {product.brand}</p>
          )}

          {/* Price */}
          <Card className="p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">
                {formatPrice(product.price_per_unit)}
              </span>
              <span className="text-sm text-muted-foreground">/ {product.unit}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              MOQ: {product.moq} {product.unit}
            </p>
            {product.negotiable && (
              <Badge variant="secondary" className="mt-2">Negotiable</Badge>
            )}
          </Card>

          {/* Quick specs */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Stock</span>
              <p className="font-medium">
                {product.stock_qty > 0 ? `${product.stock_qty} in stock` : "Out of stock"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Lead Time</span>
              <p className="font-medium">{product.lead_time_days} days</p>
            </div>
            <div>
              <span className="text-muted-foreground">GST Rate</span>
              <p className="font-medium">{product.gst_rate ?? 0}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">HSN Code</span>
              <p className="font-medium">{product.hsn_code}</p>
            </div>
          </div>

          {/* Sample */}
          {product.sample_available && (
            <div className="text-sm">
              <span className="text-muted-foreground">Sample: </span>
              <span className="font-medium">
                {product.sample_price ? formatPrice(product.sample_price) : "Available"}
              </span>
            </div>
          )}

          {/* Certifications */}
          {product.certifications.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.certifications.map((cert) => (
                <Badge key={cert} variant="outline">{cert}</Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Supplier info */}
          {product.supplier && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                {product.supplier.logo_path ? (
                  <img
                    src={publicImageUrl("company_logos", product.supplier.logo_path)}
                    alt={product.supplier.business_name}
                    className="size-10 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium">
                    {product.supplier.business_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">{product.supplier.business_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {product.supplier.city}, {product.supplier.state}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* CTA */}
          <Button className="w-full" size="lg">
            Send Inquiry
          </Button>
        </div>
      </div>

      {/* Tabs: Description, Specifications, Variants */}
      <div className="mt-8">
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
            <Card className="p-6">
              <div className="prose prose-sm max-w-none text-sm">
                <p className="whitespace-pre-wrap">{product.description}</p>
              </div>
              {product.packaging_details && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Packaging Details</p>
                  <p className="text-sm text-muted-foreground">{product.packaging_details}</p>
                </div>
              )}
              {product.warranty_return && (
                <div className="mt-4">
                  <p className="text-sm font-medium">Warranty & Returns</p>
                  <p className="text-sm text-muted-foreground">{product.warranty_return}</p>
                </div>
              )}
            </Card>
          </TabsContent>

          {Object.keys(product.attributes).length > 0 && (
            <TabsContent value="specifications" className="mt-4">
              <Card className="p-6">
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
              <Card className="p-6">
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
                        <TableCell>{formatPrice(v.price)}</TableCell>
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
  );
}
