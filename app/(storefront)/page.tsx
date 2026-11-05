import { Suspense } from "react"
import type { Metadata } from "next"
import type { CatalogueSearchParams } from "@/lib/catalogue"
import { AllProductsSection } from "@/components/storefront/home-sections"
import { SearchMegaMenuSection } from "@/components/storefront/search-mega-menu-section"
import { HomeBannerActions } from "@/components/storefront/home-banner-actions"
import { TopCategoriesSection } from "@/components/storefront/home-categories"
import { HomePromoSection } from "@/components/storefront/home-promo-section"
import { RecentlyViewedSection } from "@/components/storefront/home-recently-viewed"
import { FrequentlyBoughtSection } from "@/components/storefront/frequently-bought"
import { RecommendedProductsSection } from "@/components/storefront/home-recommended"
import {
  CatalogueSkeleton,
  FrequentlyBoughtSkeleton,
  RecentRailSkeleton,
  RecommendedProductsSkeleton,
  SearchHeroSkeleton,
  TopCategoriesSkeleton,
} from "@/components/storefront/skeletons"

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>
}) {
  const sp = await searchParams

  return (
    <div className="min-h-full bg-white">
      <h1 className="sr-only">
        Wholesale marketplace — source directly from verified Indian suppliers
      </h1>

      <div className="lg:hidden">
        <Suspense fallback={<SearchHeroSkeleton />}>
          <SearchMegaMenuSection />
        </Suspense>
      </div>

      <div className="lg:hidden">
        <HomeBannerActions />
      </div>

      <HomePromoSection />

      <div className="lg:hidden">
        <Suspense fallback={<TopCategoriesSkeleton />}>
          <TopCategoriesSection />
        </Suspense>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 lg:grid lg:grid-cols-[3fr_2fr] lg:gap-6">
        <div>
          <Suspense fallback={<RecentRailSkeleton />}>
            <RecentlyViewedSection />
          </Suspense>
        </div>
        <div className="lg:border-l lg:border-border lg:pl-6">
          <Suspense fallback={<FrequentlyBoughtSkeleton />}>
            <FrequentlyBoughtSection />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<RecommendedProductsSkeleton />}>
        <RecommendedProductsSection />
      </Suspense>

      <Suspense
        fallback={
          <section className="border-y border-border bg-muted/60">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:py-7">
              <CatalogueSkeleton />
            </div>
          </section>
        }
      >
        <AllProductsSection searchParams={sp} />
      </Suspense>
    </div>
  )
}
