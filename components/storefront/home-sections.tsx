import type { CatalogueSearchParams } from "@/lib/catalogue"
import { CatalogueSection } from "@/components/storefront/catalogue-section"

export async function AllProductsSection({
  searchParams,
}: {
  searchParams: CatalogueSearchParams
}) {
  return (
    <section id="all-products" className="border-y border-border bg-muted/60">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:py-7">
        <CatalogueSection
          searchParams={searchParams}
          basePath="/"
          title="All products"
          description="Browse the full catalogue from verified suppliers, with live customer pricing and MOQs."
        />
      </div>
    </section>
  )
}
