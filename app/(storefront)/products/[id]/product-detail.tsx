import { Suspense } from "react"
import { sanitizeRichText } from "@/lib/supplier/sanitize"
import { formatIndianNumber, formatRupees, stockLabel } from "@/lib/format"
import { SITE_NAME, SITE_URL } from "@/lib/site"
import { getCachedRelatedProducts } from "@/lib/storefront-cache"
import { publicTransformedImageUrl } from "@/lib/storage"
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
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card"
import { ProductBackButton } from "@/components/storefront/product-back-button"
import { ProductGallery, type GalleryImage } from "@/components/storefront/product-gallery"
import { ProductDetailTabs } from "@/components/storefront/product-content-tabs"
import { ExpandableRichText } from "@/components/storefront/expandable-rich-text"
import { SectionHeader } from "@/components/storefront/section-header"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductActionsIsland } from "./product-actions-island"
import { ProductHighlights } from "./product-highlights"
import { ProductServiceOptions } from "./product-service-options"
import { ProductStoreCard } from "./product-store-card"
import {
  ProductPricePanel,
  VariantSelectionProvider,
  type SelectableVariant,
} from "./variant-selection"

type Product = {
  id: string
  title: string
  description: string
  brand: string | null
  seller_sku: string
  hsn_code: string | null
  unit: string
  mrp: number | string | null
  is_out_of_stock?: boolean
  store_slug?: string | null
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
  kg = Number(kg)
  if (kg < 0.001) return `${formatIndianNumber(Math.round(kg * 1_000_000))} mg`
  if (kg < 1) return `${formatIndianNumber(Number((kg * 1000).toFixed(1)))} g`
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
  // Strike-through MRP only when it is genuinely above the buyer price.
  const mrp = product.mrp != null ? Number(product.mrp) : null
  const sortedVariants = [...product.variants]
    .map((v) => ({ ...v, customer_price: variantPrices.get(v.id) }))
    .sort((a, b) => a.sort - b.sort)

  const selectableVariants: SelectableVariant[] = sortedVariants.map((v) => ({
    id: v.id,
    label: v.label,
    attrs: (v.attrs ?? {}) as Record<string, string>,
    customer_price: v.customer_price,
    moq: v.moq,
  }))

  const coverImage = images[0]
    ? publicTransformedImageUrl("product_images", images[0].path, {
        width: 320,
        height: 320,
      })
    : null

  const descriptionHtml = sanitizeRichText(product.description ?? "")
  const hasDescription =
    descriptionHtml.replace(/<[^>]*>/g, " ").trim().length > 0
  // HSN code, GST rate, carton qty and weight: shown under the price and again
  // at the top of the Highlights tab. Only filled-in values appear.
  const specRows = highlightRows(product).filter((row) => row.value !== "—")
  const hasHighlights =
    specRows.length > 0 ||
    attributeEntries.length > 0 ||
    sortedVariants.length > 0 ||
    Boolean(product.packaging_details)

  const shareText = `Hi, I'm interested in ${product.title} on ${SITE_NAME}: ${SITE_URL}/products/${product.id}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  // Personalized buy box streams in separately (own Suspense below) so the
  // cached body never waits for per-user lookups.

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-5">
      <ProductBackButton />

      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] md:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-8">
        {/* Product imagery */}
        <div className="min-w-0">
          <ProductGallery
            images={images}
            title={product.title}
            negotiable={product.negotiable}
            youtubeId={product.youtube_id}
          />
        </div>

        {/* Product information and actions. The provider shares the chosen
            variant between the price panel and the add-to-cart form. */}
        <VariantSelectionProvider variants={selectableVariants}>
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h1 className="text-lg font-bold leading-snug tracking-tight sm:text-xl md:text-2xl">
              {product.title}
            </h1>
            <div className="mt-3">
              <ProductPricePanel
                basePrice={pricing?.customer_price ?? null}
                mrp={mrp}
                negotiable={product.negotiable}
                outOfStock={Boolean(product.is_out_of_stock)}
                variants={selectableVariants}
              />
            </div>
            {product.sample_available ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Sample available</p>
            ) : null}
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

          {supplier && (
            <ProductStoreCard supplier={supplier} storeSlug={product.store_slug ?? null} />
          )}

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
              title={product.title}
              image={coverImage}
              moq={product.moq}
              unit={product.unit}
              outOfStock={Boolean(product.is_out_of_stock)}
              variants={sortedVariants.map((v) => ({
                id: v.id,
                label: v.label,
                customer_price: v.customer_price,
                moq: v.moq,
              }))}
            />
          </Suspense>
        </div>
        </VariantSelectionProvider>
      </div>

      {/* Description / highlights */}
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
                  {specRows.length > 0 && (
                    <Table>
                      <TableBody>
                        {specRows.map((row) => (
                          <TableRow key={row.label}>
                            <TableHead className="w-40 font-medium">{row.label}</TableHead>
                            <TableCell className="tabular-nums">{row.value}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

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
