import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import {
  getProducts,
  getProductsByImage,
  getNavigationCategories,
  type ProductSort,
} from "@/lib/storefront"
import {
  buildPageUrl,
  parseBoolean,
  parseImageQueryId,
  parseNumber,
  parseSort,
} from "@/lib/storefront-query"
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
import { isImageSearchConfigured } from "@/lib/embeddings"

type SearchParams = {
  q?: string
  img?: string
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
}

function FilterBarSkeleton() {
  return (
    <div aria-hidden className="mb-4 flex flex-col gap-3">
      <Skeleton className="h-10 w-full max-w-md" />
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
  // An image query takes precedence over ?q: the ranking is visual, so a
  // leftover text term would only mislead the result count.
  const imageQueryId = parseImageQueryId(sp.img)
  const isImageMode = imageQueryId !== null
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

  const supabase = await createClient()

  const result = isImageMode
    ? await getProductsByImage(supabase, {
        queryId: imageQueryId,
        categorySlug,
        minPrice,
        maxPrice,
        minMoq,
        maxMoq,
        inStock: inStock ?? undefined,
        negotiable: negotiable ?? undefined,
        sampleAvailable: sampleAvailable ?? undefined,
        page,
        perPage: 24,
      })
    : await getProducts(supabase, {
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
      })

  // A null result is a backend failure, not "no matches" — show it as such.
  if (result === null) {
    return (
      <div className="py-16">
        <Empty>
          <EmptyTitle>Search is unavailable</EmptyTitle>
          <EmptyDescription>
            We could not load results just now. Please try again.
          </EmptyDescription>
          <Link href="/products">
            <Button variant="outline" size="sm" className="mt-3">
              Back to all products
            </Button>
          </Link>
        </Empty>
      </div>
    )
  }

  const { products, total, totalPages } = result
  const imageExpired = isImageMode && "expired" in result && result.expired

  const activeFilter = categorySlug
    ? ((await getNavigationCategories(supabase)).find(
        (c) => c.slug === categorySlug,
      )?.name ?? null)
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
    const url = new URLSearchParams()
    if (imageQueryId) url.set("img", imageQueryId)
    else if (query) url.set("q", query)
    if (categorySlug && removeParams.category === undefined) url.set("category", categorySlug)
    if (!isImageMode && sort !== "relevance") url.set("sort", sort)
    if (minPrice != null && removeParams.minPrice === undefined) url.set("minPrice", String(minPrice))
    if (maxPrice != null && removeParams.maxPrice === undefined) url.set("maxPrice", String(maxPrice))
    if (minMoq != null && removeParams.minMoq === undefined) url.set("minMoq", String(minMoq))
    if (maxMoq != null && removeParams.maxMoq === undefined) url.set("maxMoq", String(maxMoq))
    if (inStock && removeParams.inStock === undefined) url.set("inStock", "true")
    if (negotiable && removeParams.negotiable === undefined) url.set("negotiable", "true")
    if (sampleAvailable && removeParams.sampleAvailable === undefined) url.set("sampleAvailable", "true")
    url.set("page", "1")
    return `/products?${url.toString()}`
  }

  const clearAllUrl = () => {
    const url = new URLSearchParams()
    if (imageQueryId) url.set("img", imageQueryId)
    else if (query) url.set("q", query)
    if (categorySlug) url.set("category", categorySlug)
    return `/products?${url.toString()}`
  }

  // Exits image search entirely, back to the plain catalog.
  const exitImageSearchUrl = () => {
    const url = new URLSearchParams()
    if (categorySlug) url.set("category", categorySlug)
    return `/products?${url.toString()}`
  }

  const pageUrl = (targetPage: number) =>
    buildPageUrl({
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
      imageQueryId,
      page: targetPage,
    })

  return (
    <>
      {/* Results meta */}
      <div className="mb-4 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> product
          {total !== 1 ? "s" : ""} found
          {isImageMode ? " similar to your image" : query && <> for &ldquo;{query}&rdquo;</>}
        </p>
        {!isImageMode && sort !== "relevance" && (
          <span className="text-xs text-muted-foreground">
            Sorted by {SORT_LABELS[sort]}
          </span>
        )}
        {isImageMode && (
          <Link
            href={exitImageSearchUrl()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Exit image search
          </Link>
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
              {imageExpired ? "That image search has expired" : "No products found"}
            </EmptyTitle>
            <EmptyDescription>
              {imageExpired
                ? "Image searches are kept for 24 hours. Upload the image again to search."
                : isImageMode
                  ? "No products look similar enough to your image. Try a clearer photo or widen the filters."
                  : "Try a different search or clear the filters."}
            </EmptyDescription>
            <Link href={imageExpired || isImageMode ? exitImageSearchUrl() : "/products"}>
              <Button variant="outline" size="sm" className="mt-3">
                {imageExpired || isImageMode ? "Browse all products" : "Clear filters"}
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
                  <PaginationPrevious href={pageUrl(page - 1)} />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <PaginationItem key={p}>
                    <PaginationLink href={pageUrl(p)} isActive={p === page}>
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext href={pageUrl(page + 1)} />
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
        <ProductsFilterBar imageSearchEnabled={isImageSearchConfigured()} />
      </Suspense>

      <Suspense fallback={<ProductGridSkeleton count={20} />}>
        <ProductListings searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
