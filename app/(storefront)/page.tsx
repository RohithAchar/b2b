import { Suspense } from "react"
import { AllProductsSection } from "@/components/storefront/home-sections"
import { SearchMegaMenuSection } from "@/components/storefront/search-mega-menu-section"
import { ProductGridSkeleton } from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

function SearchHeroSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="flex flex-col rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-2 px-5 pt-5">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-sm" />
        </div>
        <div className="mt-5 grid border-t border-border lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-2 p-4 max-lg:hidden">
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
            <Skeleton className="h-9 w-full rounded-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
            <Skeleton className="h-14 w-full rounded-sm" />
            <Skeleton className="h-14 w-full rounded-sm" />
            <Skeleton className="h-14 w-full rounded-sm" />
            <Skeleton className="h-14 w-full rounded-sm" />
            <Skeleton className="h-14 w-full rounded-sm" />
            <Skeleton className="h-14 w-full rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <>
      {/* Search hero */}
      <Suspense fallback={<SearchHeroSkeleton />}>
        <SearchMegaMenuSection />
      </Suspense>

      {/* All products */}
      <Suspense
        fallback={
          <section className="border-y border-border bg-muted">
            <div className="mx-auto w-full max-w-7xl px-4 py-6">
              <ProductGridSkeleton
                count={8}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              />
            </div>
          </section>
        }
      >
        <AllProductsSection />
      </Suspense>
    </>
  )
}
