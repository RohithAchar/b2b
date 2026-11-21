import { getCachedHomeCategories } from "@/lib/storefront-cache"
import { SectionHeader } from "@/components/storefront/section-header"
import { CategoryTile } from "@/components/storefront/category-tiles"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

/**
 * Every active category in one row that scrolls sideways: swipe on phones,
 * arrow buttons from md up (same carousel as the product rails).
 */
export async function TopCategoriesSection() {
  const categories = await getCachedHomeCategories()
  if (categories.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader title="Top categories" />
      <Carousel opts={{ align: "start", loop: false, dragFree: true }} className="relative">
        <CarouselContent className="-ml-2.5">
          {categories.map((category, index) => (
            <CarouselItem
              key={category.id}
              className="basis-[96px] pl-2.5 sm:basis-1/5 md:basis-1/6 lg:basis-1/8"
            >
              <CategoryTile
                category={category}
                priority={index === 0}
                showCount={false}
                sizes="(min-width: 1024px) 12vw, (min-width: 768px) 16vw, 96px"
                className="w-full"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {categories.length > 1 ? (
          <>
            <CarouselPrevious className="-left-4 z-10 hidden size-9 border-border bg-card shadow-sm hover:bg-muted md:inline-flex" />
            <CarouselNext className="-right-4 z-10 hidden size-9 border-border bg-card shadow-sm hover:bg-muted md:inline-flex" />
          </>
        ) : null}
      </Carousel>
    </section>
  )
}
