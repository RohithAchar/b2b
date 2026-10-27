import { Suspense } from "react"
import type { Metadata } from "next"
import type { CatalogueSearchParams } from "@/lib/catalogue"
import { AllProductsSection } from "@/components/storefront/home-sections"
import { SearchMegaMenuSection } from "@/components/storefront/search-mega-menu-section"
import {
  CatalogueSkeleton,
  SearchHeroSkeleton,
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
    <>
      <h1 className="sr-only">
        Wholesale marketplace — source directly from verified Indian suppliers
      </h1>
      <Suspense fallback={<SearchHeroSkeleton />}>
        <SearchMegaMenuSection />
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
    </>
  )
}
