import Link from "next/link"
import { getCachedHomeCategories } from "@/lib/storefront-cache"
import { publicTransformedImageUrl } from "@/lib/storage"
import { SectionHeader } from "@/components/storefront/section-header"
import { ProductImage } from "@/components/storefront/product-image"

const MAX_TILES = 8

const RAIL_CLASS =
  "-mx-4 no-scrollbar flex snap-x gap-2.5 overflow-x-auto scroll-pl-4 px-4 pb-1 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 lg:grid-cols-8"

export async function TopCategoriesSection() {
  const categories = await getCachedHomeCategories()
  if (categories.length === 0) return null

  const visible = categories.slice(0, MAX_TILES)

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader title="Top categories" />
      <div className={RAIL_CLASS}>
        {visible.map((category, index) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className="group w-[84px] shrink-0 snap-start press md:w-auto"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
              {category.image_path ? (
                <ProductImage
                  src={publicTransformedImageUrl(
                    "category_images",
                    category.image_path,
                    { width: 200 }
                  )}
                  alt=""
                  sizes="(min-width: 1024px) 12vw, (min-width: 768px) 18vw, 84px"
                  priority={index === 0}
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
            <p className="mt-1.5 line-clamp-2 text-center text-[11px] leading-snug font-semibold text-foreground">
              {category.name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
