import { Suspense } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getProducts, getNavigationCategories } from "@/lib/storefront"
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
import {
  ProductsFilterBar,
  buildPageUrl,
} from "@/components/storefront/products-filter-bar"

type SearchParams = { q?: string; category?: string; page?: string }

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

async function ProductListings({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const query = sp.q ?? ""
  const categorySlug = sp.category ?? ""
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  const supabase = await createClient()
  const { products, total, totalPages } = await getProducts(supabase, {
    query,
    categorySlug,
    page,
    perPage: 24,
  })

  const activeFilter = categorySlug
    ? ((await getNavigationCategories(supabase)).find(
        (c) => c.slug === categorySlug
      )?.name ?? null)
    : null

  return (
    <>
      {/* Results meta */}
      <div className="mb-4 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{total}</span> product
          {total !== 1 ? "s" : ""} found
          {query && <> for &ldquo;{query}&rdquo;</>}
        </p>
        {activeFilter && (
          <Link
            aria-label={`Remove ${activeFilter} filter`}
            href={
              query ? `/products?q=${encodeURIComponent(query)}` : "/products"
            }
            className="inline-flex items-center gap-1 rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            {activeFilter}
            <span aria-hidden>×</span>
          </Link>
        )}
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="py-16">
          <Empty>
            <EmptyTitle>No products found</EmptyTitle>
            <EmptyDescription>
              Try a different search or clear the filters.
            </EmptyDescription>
            <Link href="/products">
              <Button variant="outline" size="sm" className="mt-3">
                Clear filters
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
                    href={buildPageUrl(query, categorySlug, page - 1)}
                  />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href={buildPageUrl(query, categorySlug, p)}
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
                    href={buildPageUrl(query, categorySlug, page + 1)}
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
