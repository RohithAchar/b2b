import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { getCachedHomeCategories } from "@/lib/storefront-cache"
import { publicTransformedImageUrl } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { ProductImage } from "@/components/storefront/product-image"

const QUICK_ACTIONS = [9, 49, 99, 199] as const

/**
 * Desktop-only promotional area following the desktop reference layout:
 * banner | 2x2 budget cards | top categories. Hidden below `lg`; mobile uses
 * `HomeBannerActions` + `TopCategoriesSection` instead.
 */
export async function HomePromoSection() {
  const categories = await getCachedHomeCategories()
  const visible = categories.slice(0, 6)

  return (
    <section className="hidden mx-auto w-full max-w-7xl px-4 py-5 lg:block">
      <div className="grid grid-cols-[20%_32%_1fr] gap-6">
        {/* Promotional banner */}
        <div className="relative overflow-hidden rounded-xl border border-brand-200 bg-brand-50 p-5">
          <div
            aria-hidden="true"
            className="absolute -top-6 -right-6 size-20 rounded-full bg-brand-100/70"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-8 -left-5 size-24 rounded-full bg-brand-100/60"
          />
          <div className="relative flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              D
            </span>
            <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
              Banner
            </p>
            <p className="max-w-28 text-[11px] leading-snug text-muted-foreground">
              Artwork coming soon
            </p>
          </div>
        </div>

        {/* Budget shopping cards */}
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((amount) => (
            <Link
              key={amount}
              href={`/products?maxPrice=${amount}`}
              className="press group relative flex min-h-28 flex-col justify-center rounded-xl border border-brand-200 bg-card px-3 py-3 text-center hover:border-brand-300 hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
            >
              <HugeiconsIcon
                icon={Add01Icon}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute top-2 right-2 size-3.5 text-brand-400 transition-colors group-hover:text-brand-600"
              />
              <span className="text-[11px] font-medium text-brand-700 sm:text-xs">
                Shop under
              </span>
              <span className="mt-0.5 text-xl font-bold tracking-tight text-foreground tabular-nums sm:text-2xl">
                ₹{amount}
              </span>
            </Link>
          ))}
        </div>

        {/* Top categories */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Top categories</h2>
            <Link
              href="/categories"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View More →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
            {visible.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="group press"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
                  {category.image_path ? (
                    <ProductImage
                      src={publicTransformedImageUrl(
                        "category_images",
                        category.image_path,
                        { width: 200 }
                      )}
                      alt={category.name}
                      sizes="120px"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-full w-full items-center justify-center bg-brand-50 text-lg font-bold text-brand-700"
                    >
                      {category.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-1 text-center text-xs font-medium text-foreground">
                  {category.name}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
