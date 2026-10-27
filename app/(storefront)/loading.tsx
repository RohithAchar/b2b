import {
  CatalogueSkeleton,
  SearchHeroSkeleton,
} from "@/components/storefront/skeletons"

export default function StorefrontLoading() {
  return (
    <>
      <SearchHeroSkeleton />
      <section aria-hidden className="border-y border-border bg-muted/60">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:py-7">
          <CatalogueSkeleton />
        </div>
      </section>
    </>
  )
}
