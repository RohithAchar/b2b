import { Suspense } from "react"
import type { Metadata } from "next"
import { AllProductsSection } from "@/components/storefront/home-sections"
import { SearchMegaMenuSection } from "@/components/storefront/search-mega-menu-section"
import {
  ProductGridSkeleton,
  SearchHeroSkeleton,
} from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Wholesale Marketplace from India",
  description:
    "Source wholesale products across textiles, electronics, chemicals, packaging and more — directly from verified Indian suppliers with live pricing.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Wholesale Marketplace from India",
    description:
      "Source wholesale products across textiles, electronics, chemicals, packaging and more — directly from verified Indian suppliers with live pricing.",
    url: "/",
  },
}

export default function HomePage() {
  return (
    <>
      {/* Search hero */}
      <h1 className="sr-only">
        Wholesale marketplace — source directly from verified Indian suppliers
      </h1>
      <Suspense fallback={<SearchHeroSkeleton />}>
        <SearchMegaMenuSection />
      </Suspense>

      {/* All products */}
      <Suspense
        fallback={
          <section className="border-y border-border bg-muted">
            <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-6">
              <div className="mb-3 flex items-end justify-between gap-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-16" />
              </div>
              <ProductGridSkeleton
                count={8}
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4"
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
