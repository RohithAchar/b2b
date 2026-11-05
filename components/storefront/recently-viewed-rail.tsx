import Link from "next/link"
import { SectionHeader } from "@/components/storefront/section-header"
import { ProductImage } from "@/components/storefront/product-image"

export type RecentRailItem = {
  id: string
  title: string
  image: string | null
}

const RAIL_CLASS =
  "-mx-4 no-scrollbar flex snap-x gap-3 overflow-x-auto scroll-pl-4 px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 lg:grid-cols-6"

/**
 * Compact recently-viewed cards: image + title only, so the rail stays a
 * navigation aid and never shows a stale price captured from localStorage.
 */
export function RecentlyViewedRail({ items }: { items: RecentRailItem[] }) {
  return (
    <div className={RAIL_CLASS}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/products/${item.id}`}
          className="group w-36 shrink-0 snap-start press md:w-auto"
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
            <ProductImage
              src={item.image}
              alt={item.title}
              sizes="(min-width: 1024px) 16vw, (min-width: 768px) 23vw, 144px"
            />
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium text-foreground">
            {item.title}
          </p>
        </Link>
      ))}
    </div>
  )
}

export function RecentlyViewedBlock({
  items,
  showViewAll = false,
}: {
  items: RecentRailItem[]
  showViewAll?: boolean
}) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader
        title="Recently viewed"
        actionLabel={showViewAll ? "View all" : undefined}
        actionHref={showViewAll ? "/account?tab=recent" : undefined}
      />
      <RecentlyViewedRail items={items} />
    </section>
  )
}
