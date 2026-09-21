import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { publicImageUrl } from "@/lib/storage"
import {
  getCategoryBySlug,
  getCategoryProductCount,
  getProducts,
  getNavigationCategories,
} from "@/lib/storefront"
import { getSessionUser } from "@/lib/auth/session"
import { StorefrontShell } from "@/components/layout/storefront-shell"
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

async function CategoryProductListings({
  slug,
  page,
}: {
  slug: string
  page: number
}) {
  const supabase = await createClient()
  const { products, totalPages } = await getProducts(supabase, {
    categorySlug: slug,
    page,
    perPage: 24,
  })

  function buildPageUrl(p: number) {
    return `/category/${slug}?page=${p}`
  }

  return (
    <>
      {products.length === 0 ? (
        <div className="py-16">
          <Empty>
            <EmptyTitle>No products in this category yet</EmptyTitle>
            <EmptyDescription>
              Suppliers haven&apos;t listed products here yet.
            </EmptyDescription>
            <Link href="/products">
              <Button variant="outline" size="sm" className="mt-3">
                Browse all products
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
                  <PaginationPrevious href={buildPageUrl(page - 1)} />
                </PaginationItem>
              )}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href={buildPageUrl(p)}
                      isActive={p === page}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              {page < totalPages && (
                <PaginationItem>
                  <PaginationNext href={buildPageUrl(page + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  )
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1)

  const supabase = await createClient()
  const category = await getCategoryBySlug(supabase, slug)
  if (!category) notFound()

  const [sessionUser, navCategories, productCount] = await Promise.all([
    getSessionUser(supabase),
    getNavigationCategories(supabase),
    getCategoryProductCount(supabase, category.id),
  ])

  return (
    <StorefrontShell user={sessionUser} categories={navCategories}>
      <div className="mx-auto w-full max-w-7xl px-4 py-5">
        <Breadcrumbs
          items={[{ label: "Home", href: "/" }, { label: category.name }]}
        />

        {/* Category header */}
        <div className="mb-5 flex items-center gap-4 border-b border-border pb-4">
          {category.image_path && (
            <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={publicImageUrl("category_images", category.image_path)}
                alt={category.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {category.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {productCount} product{productCount !== 1 ? "s" : ""} from
              verified suppliers
            </p>
          </div>
        </div>

        {/* Subcategories */}
        {category.subcategories.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            <span className="mr-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Sub-categories:
            </span>
            {category.subcategories.map((sub) => (
              <Link key={sub.id} href={`/category/${sub.slug}`}>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  className="h-7 rounded-sm text-xs"
                >
                  {sub.name}
                </Button>
              </Link>
            ))}
          </div>
        )}

        <Suspense fallback={<ProductGridSkeleton count={20} />}>
          <CategoryProductListings slug={slug} page={page} />
        </Suspense>
      </div>
    </StorefrontShell>
  )
}
