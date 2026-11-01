import { Suspense } from "react"
import { sanitizeRichText } from "@/lib/supplier/sanitize"
import { formatIndianNumber, formatRupees, stockLabel } from "@/lib/format"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { getCachedRelatedProducts } from "@/lib/storefront-cache"
import type { CustomerPrices } from "@/lib/pricing"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card"
import { ProductGallery, type GalleryImage } from "@/components/storefront/product-gallery"
import { ProductDetailTabs } from "@/components/storefront/product-content-tabs"
import { ExpandableRichText } from "@/components/storefront/expandable-rich-text"
import { SectionHeader } from "@/components/storefront/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductActionsIsland } from "./product-actions-island"
import { ProductHighlights } from "./product-highlights"
import { ProductServiceOptions } from "./product-service-options"
import { ProductStoreCard } from "./product-store-card"

type Product = {
  id: string
  title: string
  description: string
  brand: string | null
  seller_sku: string
  hsn_code: string
  unit: string
  moq: number
  stock_qty: number
  negotiable: boolean
  sample_available: boolean
  lead_time_days: number
  gst_rate: number | null
  attributes: Record<string, string>
  certifications: string[]
  packaging_details: string | null
  warranty_return: string | null
  carton_units: number | null
  carton_dimensions: string | null
  carton_weight_kg: number | null
  youtube_url: string | null
  youtube_id: string | null
  created_at: string
  category: { id: string; name: string; slug: string } | null
  supplier: {
    id: string
    business_name: string
    city: string
    state: string
    logo_path: string | null
  } | null
  images: { id: string; path: string; sort: number; alt: string | null }[]
  variants: {
    id: string
    label: string
    attrs: Record<string, string>
    seller_sku: string
    moq: number | null
    stock_qty: number
    sort: number
  }[]
  pricing: CustomerPrices | null
}

function weightLabel(kg: number | null): string {
  if (kg == null) return "—"
  if (kg < 1) return `${formatIndianNumber(Math.round(kg * 1000))} gm`
  return `${formatIndianNumber(kg)} kg`
}

function highlightRows(product: Product) {
  return [
    { label: "HSN Code", value: product.hsn_code || "—" },
    {
      label: "GST Rate",
      value: product.gst_rate != null ? `${product.gst_rate}%` : "—",
    },
    {
      label: "Carton Qty",
      value:
        product.carton_units != null
          ? formatIndianNumber(product.carton_units)
          : "—",
    },
    { label: "Weight", value: weightLabel(product.carton_weight_kg) },
  ]
}

export function ProductDetail({ product }: { product: Product }) {
  const images: GalleryImage[] = [...product.images].sort((a, b) => a.sort - b.sort)
  const supplier = product.supplier
  const attributeEntries = Object.entries(product.attributes)

  // Customer prices are derived server-side and arrive in `pricing`; the base
  // price and the supplier's margin are never fetched here.
  const pricing = product.pricing
  const slabs = [...(pricing?.customer_price_slabs ?? [])].sort(
    (a, b) => a.min_qty - b.min_qty,
  )
  const variantPrices = new Map(
    (pricing?.customer_variant_prices ?? []).map((v) => [v.id, v.customer_price]),
  )
  const sortedVariants = [...product.variants]
    .map((v) => ({ ...v, customer_price: variantPrices.get(v.id) }))
    .sort((a, b) => a.sort - b.sort)

  const descriptionHtml = sanitizeRichText(product.description ?? "")
  const hasDescription =
    descriptionHtml.replace(/<[^>]*>/g, " ").trim().length > 0
  const hasHighlights =
    attributeEntries.length > 0 ||
    sortedVariants.length > 0 ||
    Boolean(product.packaging_details)

  const shareText = `Hi, I'm interested in ${product.title} on ${SITE_NAME}: ${SITE_URL}/products/${product.id}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  // Personalized buy box streams in separately (own Suspense below) so the
  // cached body never waits for per-user lookups.

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-5">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          ...(product.category
            ? [{ label: product.category.name, href: `/category/${product.category.slug}` }]
            : []),
          { label: product.title },
        ]}
      />

      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] md:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-8">
        {/* Product imagery */}
        <div className="min-w-0">
          <ProductGallery
            images={images}
            title={product.title}
            negotiable={product.negotiable}
          />
        </div>

        {/* Product information and actions */}
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h1 className="text-lg font-bold leading-snug tracking-tight sm:text-xl md:text-2xl">
              {product.title}
            </h1>
            {product.brand && (
              <p className="mt-1 text-sm text-muted-foreground">
                Brand:{" "}
                <span className="font-medium text-foreground">{product.brand}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-3xl font-bold tracking-tight text-primary tabular-nums">
                {pricing ? formatRupees(pricing.customer_price) : "Price on request"}
              </span>
              <span className="text-sm text-muted-foreground">/ {product.unit}</span>
              {product.negotiable && <Badge className="ml-auto">Price Negotiable</Badge>}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              MOQ {product.moq} {product.unit}
              {product.moq > 1 ? "s" : ""} · {stockLabel(product.stock_qty)}
              {product.sample_available ? " · Sample available" : ""}
            </p>
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

          <ProductHighlights rows={highlightRows(product)} />

          {supplier && <ProductStoreCard supplier={supplier} />}

          <ProductServiceOptions whatsappHref={whatsappHref} />

          {/* Quantity pricing */}
          {slabs.length > 0 && (
            <section aria-labelledby="quantity-pricing-heading">
              <h2
                id="quantity-pricing-heading"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Quantity Pricing
              </h2>
              <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
                <Table>
                  <TableBody>
                    {slabs.map((slab, i) => (
                      <TableRow key={i} className="border-b-0 hover:bg-transparent">
                        <TableCell className="text-sm text-muted-foreground">
                          {slab.min_qty}+ {product.unit}s
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums text-foreground">
                          {formatRupees(slab.price)}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            / {product.unit}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          {/* Buy actions: personalized island streams in after the cached body */}
          <Suspense
            fallback={
              <div className="flex flex-col gap-2" aria-hidden>
                <Skeleton className="h-11 w-full rounded-md" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-10 rounded-md" />
                  <Skeleton className="h-4 self-center rounded-sm" />
                </div>
              </div>
            }
          >
            <ProductActionsIsland
              productId={product.id}
              moq={product.moq}
              unit={product.unit}
              variants={sortedVariants.map((v) => ({
                id: v.id,
                label: v.label,
                customer_price: v.customer_price,
                moq: v.moq,
              }))}
              shipFrom={supplier ? `${supplier.city}, ${supplier.state}` : null}
            />
          </Suspense>
        </div>
      </div>

      {/* Description / highlights / return policy */}
      <div className="mt-8">
        <ProductDetailTabs
          description={
            <Card className="rounded-lg p-4 sm:p-6">
              {hasDescription ? (
                <ExpandableRichText html={descriptionHtml} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  This supplier has not provided a description for this product.
                </p>
              )}
            </Card>
          }
          highlights={
            <Card className="rounded-lg p-4 sm:p-6">
              {hasHighlights ? (
                <div className="flex flex-col gap-6">
                  {attributeEntries.length > 0 && (
                    <Table>
                      <TableBody>
                        {attributeEntries.map(([key, value]) => (
                          <TableRow key={key}>
                            <TableHead className="w-40 font-medium">{key}</TableHead>
                            <TableCell>{value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {product.packaging_details && (
                    <div>
                      <h3 className="text-sm font-semibold">Packaging Details</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {product.packaging_details}
                      </p>
                    </div>
                  )}

                  {sortedVariants.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold">Variants</h3>
                      <div className="mt-2 overflow-x-auto">
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
                                <TableCell className="font-semibold">
                                  {v.customer_price != null
                                    ? formatRupees(v.customer_price)
                                    : "—"}
                                </TableCell>
                                <TableCell>{v.moq ?? product.moq}+</TableCell>
                                <TableCell>{stockLabel(v.stock_qty)}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {v.seller_sku}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional highlights have been provided for this product.
                </p>
              )}
            </Card>
          }
          returnPolicy={
            <Card className="rounded-lg p-4 sm:p-6">
              {product.warranty_return ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.warranty_return}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This supplier has not provided return policy details for this
                  product.
                </p>
              )}
            </Card>
          }
        />
      </div>
    </div>
  )
}

export async function RelatedProductsSection({
  categoryId,
  excludeId,
}: {
  categoryId: string | null
  excludeId: string
}) {
  if (!categoryId) return null

  const related = await getCachedRelatedProducts(categoryId, excludeId)

  if (related.length === 0) return null

  return (
    <div className="mx-auto mt-10 w-full max-w-7xl px-4">
      <SectionHeader title="Related Products" subtitle="More from this category" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {related.slice(0, 8).map((product) => (
          <ProductCard key={product.id} product={product as ProductCardData} />
        ))}
      </div>
    </div>
  )
}
