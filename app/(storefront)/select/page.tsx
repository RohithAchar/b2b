import { Suspense } from "react"
import type { Metadata } from "next"
import { getCachedDealsStoreId } from "@/lib/storefront-cache"
import { SelectPromotionalCollections } from "@/components/storefront/select-promotional-collections"
import { TopCategoriesSection } from "@/components/storefront/home-categories"
import { FrequentlyBoughtSection } from "@/components/storefront/frequently-bought"
import { RecommendedProductsSection } from "@/components/storefront/home-recommended"
import {
  PromotionalCollectionsSkeleton,
  RecommendedProductsSkeleton,
  TopCategoriesSkeleton,
} from "@/components/storefront/skeletons"

export const metadata: Metadata = {
  title: "D2H Select — Curated wholesale picks",
  description: "Curated winning products, hot selling items and price-based deals from verified suppliers.",
  alternates: { canonical: "/select" },
  openGraph: { title: "D2H Select", url: "/select" },
}

export default async function SelectPage() {
  // Everything on this page is D2H Select's own catalogue (never D2H Core).
  const selectStoreId = await getCachedDealsStoreId()

  return (
    <div className="min-h-full bg-white">
      <h1 className="sr-only">D2H Select — curated wholesale picks</h1>

      <Suspense fallback={<PromotionalCollectionsSkeleton />}>
        <SelectPromotionalCollections />
      </Suspense>

      <Suspense fallback={<TopCategoriesSkeleton />}>
        <TopCategoriesSection />
      </Suspense>

      <Suspense fallback={null}>
        <FrequentlyBoughtSection />
      </Suspense>

      <Suspense fallback={<RecommendedProductsSkeleton />}>
        <RecommendedProductsSection storeId={selectStoreId} />
      </Suspense>
    </div>
  )
}