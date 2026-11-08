import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { getCachedHomeProducts } from "@/lib/storefront-cache"
import { publicTransformedImageUrl } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/storefront/section-header"
import { ProductImage } from "@/components/storefront/product-image"

const BUNDLE_SIZE = 4

function coverUrl(images: { path: string; sort: number }[] | null) {
  const cover = [...(images ?? [])].sort((a, b) => a.sort - b.sort)[0]
  return cover
    ? publicTransformedImageUrl("product_images", cover.path, { width: 240 })
    : null
}

/**
 * Placeholder purchase-grouping section.
 *
 * There is no co-purchase aggregation yet, so this groups real newest listings
 * into sample bundles and labels them as a preview. Replace the grouping (not
 * the card layout) when the real query lands.
 */
export async function FrequentlyBoughtSection() {
  const products = await getCachedHomeProducts()
  if (products.length < BUNDLE_SIZE) return null

  const bundles: (typeof products)[] = []
  for (let i = 0; i + BUNDLE_SIZE <= products.length; i += BUNDLE_SIZE) {
    bundles.push(products.slice(i, i + BUNDLE_SIZE))
    if (bundles.length === 2) break
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader
        title="Frequently bought"
        subtitle="Preview — sample bundles, not real purchase history yet"
      />

      <div className="grid grid-cols-2 gap-3">
        {bundles.map((bundle, bundleIndex) => (
          <div
            key={bundleIndex}
            className="rounded-xl border border-border bg-card p-1.5 pb-2"
          >
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {bundle.map((product, index) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className={index > 1 ? "group press max-sm:hidden" : "group press"}
                  aria-label={product.title}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted">
                    <ProductImage
                      src={coverUrl(product.images)}
                      alt={product.title}
                      sizes="(min-width: 640px) 12vw, 44vw"
                      priority={index < 2}
                    />
                  </div>
                </Link>
              ))}
            </div>
            <div className="relative z-10 -mt-4 flex justify-center">
              <Link
                href="/products"
                className="press inline-flex h-8 items-center rounded-md border border-brand-200 bg-card px-4 text-xs font-semibold text-brand-700 shadow-sm hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
              >
                4+ more
              </Link>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/orders" />}
        className="mt-2 h-10 w-full border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-800"
      >
        See all orders
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2.2}
          data-icon="inline-end"
        />
      </Button>
    </section>
  )
}
