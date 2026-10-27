import { Suspense } from "react"
import type { Metadata } from "next"
import type { CatalogueSearchParams } from "@/lib/catalogue"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { CatalogueSection } from "@/components/storefront/catalogue-section"
import { CatalogueSkeleton } from "@/components/storefront/skeletons"

export const metadata: Metadata = {
  title: "Browse Wholesale Products",
  description:
    "Browse wholesale products with live pricing and MOQs from verified Indian suppliers. Filter by category, price, MOQ and availability.",
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Browse Wholesale Products",
    description:
      "Browse wholesale products with live pricing and MOQs from verified Indian suppliers. Filter by category, price, MOQ and availability.",
    url: "/products",
  },
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogueSearchParams>
}) {
  const sp = await searchParams

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Products" }]}
      />

      <Suspense fallback={<CatalogueSkeleton />}>
        <CatalogueSection
          searchParams={sp}
          basePath="/products"
          title="All products"
          description="Live wholesale pricing and MOQs from verified suppliers."
          headingLevel="h1"
        />
      </Suspense>
    </div>
  )
}
