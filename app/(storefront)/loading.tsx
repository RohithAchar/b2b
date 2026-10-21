import {
  ProductGridSkeleton,
  SearchHeroSkeleton,
} from "@/components/storefront/skeletons"

export default function StorefrontLoading() {
  return (
    <>
      <SearchHeroSkeleton />
      <section aria-hidden className="border-y border-border bg-muted">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:py-6">
          <ProductGridSkeleton
            count={8}
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4"
          />
        </div>
      </section>
    </>
  )
}
