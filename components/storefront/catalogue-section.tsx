import {
  parseCatalogueFilters,
  type CatalogueSearchParams,
} from "@/lib/catalogue"
import {
  getCachedCatalogueCategories,
  getCachedCataloguePage,
} from "@/lib/storefront-cache"
import { Catalogue } from "@/components/storefront/catalogue"

export async function CatalogueSection({
  searchParams,
  basePath,
  title = "All products",
  description,
  headingLevel = "h2",
}: {
  searchParams: CatalogueSearchParams
  basePath: string
  title?: string
  description?: string
  headingLevel?: "h1" | "h2"
}) {
  const filters = parseCatalogueFilters(searchParams)
  const [categoryData, initialPage] = await Promise.all([
    getCachedCatalogueCategories(),
    getCachedCataloguePage(filters),
  ])

  return (
    <Catalogue
      categoryData={categoryData}
      filters={filters}
      initialPage={initialPage}
      basePath={basePath}
      title={filters.imageToken ? "Products similar to your photo" : title}
      description={
        filters.imageToken
          ? "Showing products visually similar to your uploaded image."
          : description
      }
      headingLevel={headingLevel}
    />
  )
}
