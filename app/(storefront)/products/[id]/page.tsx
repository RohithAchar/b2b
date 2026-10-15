import { Suspense } from "react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getCachedProduct } from "@/lib/storefront-cache"
import { publicImageUrl } from "@/lib/storage"
import {
  resolveProductMetaDescription,
  resolveProductMetaTitle,
} from "@/lib/product-meta"
import { SITE_NAME } from "@/lib/site"
import { ProductDetail, RelatedProductsSection } from "./product-detail"
import {
  ProductDetailSkeleton,
  ProductGridSkeleton,
} from "@/components/storefront/skeletons"

function getRootCategoryId(product: unknown): string | null {
  const p = product as { category?: unknown }
  if (!p.category) return null
  if (Array.isArray(p.category)) {
    const first = p.category[0] as { id?: string } | undefined
    return first?.id ?? null
  }
  return (p.category as { id?: string }).id ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = await getCachedProduct(id)
  if (!product) return {}

  const title = resolveProductMetaTitle(product)
  const description = resolveProductMetaDescription(product)
  const seoImagePath =
    (product.seo_image_path as string | null) ??
    (product.images as { path: string }[] | null)?.[0]?.path ??
    null
  const image = seoImagePath
    ? publicImageUrl("product_images", seoImagePath)
    : undefined

  return {
    title,
    description,
    alternates: { canonical: `/products/${id}` },
    openGraph: {
      title,
      description,
      url: `/products/${id}`,
      siteName: SITE_NAME,
      type: "website",
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getCachedProduct(id)

  if (!product) notFound()

  const catId = getRootCategoryId(product)

  const pricing = product.pricing as { customer_price?: number } | null
  const stockQty = (product.stock_qty as number | null) ?? 0
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(product.description ? { description: (product.description as string).slice(0, 500) } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(pricing?.customer_price != null
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: pricing.customer_price,
            availability:
              stockQty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `/products/${id}`,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl px-4 py-5">
            <ProductDetailSkeleton />
          </div>
        }
      >
        <ProductDetail product={product as never} />
      </Suspense>
      {catId && (
        <Suspense
          fallback={
            <div className="mx-auto mt-10 w-full max-w-7xl px-4">
              <ProductGridSkeleton
                count={4}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              />
            </div>
          }
        >
          <RelatedProductsSection categoryId={catId} excludeId={id} />
        </Suspense>
      )}
    </>
  )
}
