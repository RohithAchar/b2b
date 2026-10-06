import { Suspense } from "react"
import Link from "next/link"
import { getCachedNavigationCategories, getCachedProducts } from "@/lib/storefront-cache"
import type { ProductSort } from "@/lib/storefront"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  ProductCard,
  type ProductCardData,
} from "@/components/storefront/product-card"
import { ProductGridSkeleton } from "@/components/storefront/skeletons"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductsFilterBar } from "@/components/storefront/products-filter-bar"
import { decodeImageResultToken } from "@/lib/ai/image-result-token"

type SearchParams = {
  q?: string
  category?: string
  sort?: string
  minPrice?: string
  maxPrice?: string
  minMoq?: string
  maxMoq?: string
  inStock?: string
  negotiable?: string
  sampleAvailable?: string
  page?: string
  img?: string
}

const VALID_SORTS: ProductSort[] = ["relevance", "newest", "price_asc", "price_desc", "moq_asc"]

function parseSort(value: string | undefined): ProductSort {
  if (value && VALID_SORTS.includes(value as ProductSort)) {
    return value as ProductSort
  }
  return "relevance"
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

function buildPageUrl(params: {
  query: string
  categorySlug: string
  sort: ProductSort
  minPrice?: string
  maxPrice?: string
  minMoq?: string
  maxMoq?: string
  inStock?: string
  negotiable?: string
  sampleAvailable?: string
  page: number
  imageToken?: string
}) {
  const sp = new URLSearchParams()
  if (params.query) sp.set("q", params.query)
  if (params.categorySlug) sp.set("category", params.categorySlug)
  if (params.sort !== "relevance") sp.set("sort", params.sort)
  if (params.minPrice) sp.set("minPrice", params.minPrice)
  if (params.maxPrice) sp.set("maxPrice", params.maxPrice)
  if (params.minMoq) sp.set("minMoq", params.minMoq)
  if (params.maxMoq) sp.set("maxMoq", params.maxMoq)
  if (params.inStock === "true") sp.set("inStock", "true")
  if (params.negotiable === "true") sp.set("negotiable", "true")
  if (params.sampleAvailable === "true") sp.set("sampleAvailable", "true")
  if (params.imageToken) sp.set("img", params.imageToken)
  sp.set("page", String(params.page))
  return `/products?${sp.toString()}`
}

function FilterBarSkeleton() {
  return (
    <div aria-hidden className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-16 rounded-sm" />
        <Skeleton className="h-7 w-20 rounded-sm" />
        <Skeleton className="h-7 w-24 rounded-sm" />
        <Skeleton className="h-7 w-20 rounded-sm" />
      </div>
    </div>
  )
}

type ActiveFilter = {
  key: string
  label: string
  removeParams: Record<string, string | undefined>
}

async function ProductListings({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const query = sp.q ?? ""
  const categorySlug = sp.category ?? ""
  const sort = parseSort(sp.sort)
  const minPrice = parseNumber(sp.minPrice)
  const maxPrice = parseNumber(sp.maxPrice)
  const minMoq = parseNumber(sp.minMoq)
  const maxMoq = parseNumber(sp.maxMoq)
  const inStock = parseBoolean(sp.inStock)
  const negotiable = parseBoolean(sp.negotiable)
  const sampleAvailable = parseBoolean(sp.sampleAvailable)
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  // Search-by-image mode: `img` carries a compact, ordered list of product ids
  // produced by /api/search/image. A malformed token simply degrades to a normal
  // listing rather than erroring.
  const imageProductIds = decodeImageResultToken(sp.img) ?? undefined
  const imageToken = imageProductIds ? sp.img : undefined

  const [{ products, total, totalPages }, navCategories] = await Promise.all([
    getCachedProducts({
      query,
      categorySlug,
      sort,
      minPrice,
      maxPrice,
      minMoq,
      maxMoq,
      inStock: inStock ?? undefined,
      negotiable: negotiable ?? undefined,
      sampleAvailable: sampleAvailable ?? undefined,
      page,
      perPage: 24,
      imageProductIds,
    }),
    categorySlug ? getCachedNavigationCategories() : Promise.resolve([]),
  ])

  const activeFilter = categorySlug
    ? (navCategories.find((c) => c.slug === categorySlug)?.name ?? null)
    : null

  // Build active filter chips.
  const activeFilters: ActiveFilter[] = []
  if (minPrice != null) {
    activeFilters.push({
      key: "minPrice",
      label: `Min price: ₹${minPrice}`,
      removeParams: { minPrice: undefined },
    })
  }
  if (maxPrice != null) {
    activeFilters.push({
      key: "maxPrice",
      label: `Max price: ₹${maxPrice}`,
      removeParams: { maxPrice: undefined },
    })
  }
  if (minMoq != null) {
    activeFilters.push({
      key: "minMoq",
      label: `Min MOQ: ${minMoq}`,
      removeParams: { minMoq: undefined },
    })
  }
  if (maxMoq != null) {
    activeFilters.push({
      key: "maxMoq",
      label: `Max MOQ: ${maxMoq}`,
      removeParams: { maxMoq: undefined },
    })
  }
  if (inStock) {
    activeFilters.push({
      key: "inStock",
      label: "In stock",
      removeParams: { inStock: undefined },
    })
  }
  if (negotiable) {
    activeFilters.push({
      key: "negotiable",
      label: "Negotiable",
      removeParams: { negotiable: undefined },
    })
  }
  if (sampleAvailable) {
    activeFilters.push({
      key: "sampleAvailable",
      label: "Sample available",
      removeParams: { sampleAvailable: undefined },
    })
  }

  const buildFilterUrl = (removeParams: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    if (query) sp.set("q", query)
    if (categorySlug && removeParams.category === undefined) sp.set("category", categorySlug)
    if (sort !== "relevance") sp.set("sort", sort)
    if (minPrice != null && removeParams.minPrice === undefined) sp.set("minPrice", String(minPrice))
    if (maxPrice != null && removeParams.maxPrice === undefined) sp.set("maxPrice", String(maxPrice))
    if (minMoq != null && removeParams.minMoq === undefined) sp.set("minMoq", String(minMoq))
    if (maxMoq != null && removeParams.maxMoq === undefined) sp.set("maxMoq", String(maxMoq))
    if (inStock && removeParams.inStock === undefined) sp.set("inStock", "true")
    if (negotiable && removeParams.negotiable === undefined) sp.set("negotiable", "true")
    if (sampleAvailable && removeParams.sampleAvailable === undefined) sp.set("sampleAvailable", "true")
    if (imageToken) sp.set("img", imageToken)
    sp.set("page", "1")
    return `/products?${sp.toString()}`
  }

  const clearAllUrl = () => {
    const sp = new URLSearchParams()
    if (query) sp.set("q", query)
    if (categorySlug) sp.set("category", categorySlug)
    // Deliberately drops `img`: clearing filters returns to a plain listing.
    return `/products?${sp.toString()}`
  }

  const sortLabel = SORT_LABELS[sort]

  return (
    <>
      {/* Image-search heading. Deliberately says "similar", never "match" —
          this is visual similarity retrieval, not product identification. */}
      {imageProductIds && (
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Products similar to your photo
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Showing products visually similar to your uploaded image.
          </p>
        </div>
      )}

      {/* Results meta */}
      <div className="mb-4 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> product
          {total !== 1 ? "s" : ""} found
          {query && <> for &ldquo;{query}&rdquo;</>}
        </p>
        {sort !== "relevance" && (
          <span className="text-xs text-muted-foreground">
            Sorted by {sortLabel}
          </span>
        )}
        {imageProductIds && sort === "relevance" && (
          <span className="text-xs text-muted-foreground">Ordered by visual similarity</span>
        )}
      </div>

      {/* Active filter chips */}
      {(activeFilter || activeFilters.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {activeFilter && (
            <Link
              aria-label={`Remove ${activeFilter} filter`}
              href={buildFilterUrl({ category: undefined })}
              className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
            >
              {activeFilter}
              <span aria-hidden>×</span>
            </Link>
          )}
          {activeFilters.map((f) => (
            <Link
              key={f.key}
              aria-label={`Remove ${f.label} filter`}
              href={buildFilterUrl(f.removeParams)}
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {f.label}
              <span aria-hidden>×</span>
            </Link>
          ))}
          <Link
            href={clearAllUrl()}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Clear all
          </Link>
        </div>
      )}

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="py-16">
          <Empty>
            <EmptyTitle>
              {imageProductIds ? "No visually similar products found" : "No products found"}
            </EmptyTitle>
            <EmptyDescription>
              {imageProductIds
                ? "Try a photo with more of the product in frame, or browse the full catalog."
                : "Try a different search or clear the filters."}
            </EmptyDescription>
            <Link href={clearAllUrl()}>
              <Button variant="outline" size="sm" className="mt-3">
                {imageProductIds ? "Browse all products" : "Clear filters"}
              </Button>
            </Link>
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product as ProductCardData}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination>
            <PaginationContent>
              {page > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    href={buildPageUrl({
                      query,
                      categorySlug,
                      sort,
                      minPrice: sp.minPrice,
                      maxPrice: sp.maxPrice,
                      minMoq: sp.minMoq,
                      maxMoq: sp.maxMoq,
                      inStock: inStock ? "true" : undefined,
                      negotiable: negotiable ? "true" : undefined,
                      sampleAvailable: sampleAvailable ? "true" : undefined,
                      page: page - 1,
                      imageToken,
                    })}
                  />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href={buildPageUrl({
                        query,
                        categorySlug,
                        sort,
                        minPrice: sp.minPrice,
                        maxPrice: sp.maxPrice,
                        minMoq: sp.minMoq,
                        maxMoq: sp.maxMoq,
                        inStock: inStock ? "true" : undefined,
                        negotiable: negotiable ? "true" : undefined,
                        sampleAvailable: sampleAvailable ? "true" : undefined,
                        page: p,
                        imageToken,
                      })}
                      isActive={p === page}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext
                    href={buildPageUrl({
                      query,
                      categorySlug,
                      sort,
                      minPrice: sp.minPrice,
                      maxPrice: sp.maxPrice,
                      minMoq: sp.minMoq,
                      maxMoq: sp.maxMoq,
                      inStock: inStock ? "true" : undefined,
                      negotiable: negotiable ? "true" : undefined,
                      sampleAvailable: sampleAvailable ? "true" : undefined,
                      page: page + 1,
                      imageToken,
                    })}
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  )
}

const SORT_LABELS: Record<ProductSort, string> = {
  relevance: "relevance",
  newest: "newest",
  price_asc: "price: low to high",
  price_desc: "price: high to low",
  moq_asc: "MOQ: low to high",
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Products" }]}
      />

      <Suspense fallback={<FilterBarSkeleton />}>
        <ProductsFilterBar />
      </Suspense>

      <Suspense fallback={<ProductGridSkeleton count={20} />}>
        <ProductListings searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
