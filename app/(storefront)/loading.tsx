import {
  CatalogueSkeleton,
  FrequentlyBoughtSkeleton,
  HomeBannerActionsSkeleton,
  RecentRailSkeleton,
  RecommendedProductsSkeleton,
  SearchHeroSkeleton,
  TopCategoriesSkeleton,
} from "@/components/storefront/skeletons"

export default function StorefrontLoading() {
  return (
    <div className="min-h-full bg-white">
      <SearchHeroSkeleton />
      <HomeBannerActionsSkeleton />
      <TopCategoriesSkeleton />
      <RecentRailSkeleton />
      <FrequentlyBoughtSkeleton />
      <RecommendedProductsSkeleton />
      <section aria-hidden className="border-y border-border bg-muted/60">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:py-7">
          <CatalogueSkeleton />
        </div>
      </section>
    </div>
  )
}
