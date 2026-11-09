import { Suspense } from "react"
import type { Metadata } from "next"
import { SelectPromotionalCollections } from "@/components/storefront/select-promotional-collections"
import { TopCategoriesSection } from "@/components/storefront/home-categories"
import { RecentlyViewedSection } from "@/components/storefront/home-recently-viewed"
import { FrequentlyBoughtSection } from "@/components/storefront/frequently-bought"
import { RecommendedProductsSection } from "@/components/storefront/home-recommended"
import {
  FrequentlyBoughtSkeleton,
  PromotionalCollectionsSkeleton,
  RecentRailSkeleton,
  RecommendedProductsSkeleton,
  TopCategoriesSkeleton,
} from "@/components/storefront/skeletons"

export const metadata: Metadata = {
  title: "D2H Select — Curated wholesale picks",
  description: "Curated winning products, hot selling items and price-based deals from verified suppliers.",
  alternates: { canonical: "/select" },
  openGraph: { title: "D2H Select", url: "/select" },
}

export default function SelectPage() {
  return (
    <div className="min-h-full bg-white">
      <h1 className="sr-only">D2H Select — curated wholesale picks</h1>

      <Suspense fallback={<PromotionalCollectionsSkeleton />}>
        <SelectPromotionalCollections />
      </Suspense>

      <Suspense fallback={<TopCategoriesSkeleton />}>
        <TopCategoriesSection />
      </Suspense>

      <Suspense fallback={<RecentRailSkeleton />}>
        <RecentlyViewedSection />
      </Suspense>

      <Suspense fallback={<FrequentlyBoughtSkeleton />}>
        <FrequentlyBoughtSection />
      </Suspense>

      <Suspense fallback={<RecommendedProductsSkeleton />}>
        <RecommendedProductsSection />
      </Suspense>
    </div>
  )
}