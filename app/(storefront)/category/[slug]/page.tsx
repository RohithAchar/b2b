import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { publicImageUrl } from "@/lib/storage"
import {
  getCachedCategoryBySlug,
  getCachedCategoryProductCount,
  getCachedProducts,
} from "@/lib/storefront-cache"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await getCachedCategoryBySlug(slug)
  const name = (category?.name as string | undefined) ?? slug
  const title = `${name} — Wholesale Products`
  return {
    title,
    description: `Source wholesale ${name} products with live pricing and MOQs from verified Indian suppliers.`,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title,
      description: `Source wholesale ${name} products with live pricing and MOQs from verified Indian suppliers.`,
      url: `/category/${slug}`,
    },
  }
}

async function CategoryProductListings({
  slug,
  page,
  listings,
}: {
  slug: string
  page: number
  listings: ReturnType<typeof getCachedProducts>
}) {
  const { products, totalPages } = await listings

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
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/products" />}
              className="mt-3"
            >
              Browse all products
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product as ProductCardData}
              priority={index === 0}
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
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

  // Listings only need the slug, so start that query before the category row
  // resolves instead of waiting for it and then streaming.
  const listings = getCachedProducts({
    categorySlug: slug,
    page,
    perPage: 24,
  })

  const category = await getCachedCategoryBySlug(slug)
  if (!category) notFound()

  const productCount = await getCachedCategoryProductCount(category.id)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Category header */}
      <div className="mb-5 flex items-center gap-4 pb-4">
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
          <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
          <p className="text-sm text-muted-foreground">
            {productCount} product{productCount !== 1 ? "s" : ""} from verified
            suppliers
          </p>
        </div>
      </div>
      <Separator className="mb-5" />

      {/* Subcategories */}
      {category.subcategories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <span className="mr-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sub-categories:
          </span>
          {category.subcategories.map((sub) => (
            <Button
              key={sub.id}
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/category/${sub.slug}`} />}
              className="h-7 rounded-sm text-xs"
            >
              {sub.name}
            </Button>
          ))}
        </div>
      )}

      <Suspense fallback={<ProductGridSkeleton count={20} />}>
        <CategoryProductListings slug={slug} page={page} listings={listings} />
      </Suspense>
    </div>
  )
}
