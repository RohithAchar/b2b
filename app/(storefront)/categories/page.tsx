import { Suspense } from "react"
import Link from "next/link"
import type { Metadata } from "next"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { getCachedMegaMenuCategories } from "@/lib/storefront-cache"
import { publicTransformedImageUrl } from "@/lib/storage"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductImage } from "@/components/storefront/product-image"
import { CategoryPageGridSkeleton } from "@/components/storefront/skeletons"

const CATEGORY_GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"

const CATEGORY_IMAGE_SIZES =
  "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"

export const metadata: Metadata = {
  title: "Browse Categories",
  description:
    "Explore wholesale categories — textiles, electronics, chemicals, packaging, machinery and more from verified Indian suppliers.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Browse Categories",
    description:
      "Explore wholesale categories — textiles, electronics, chemicals, packaging, machinery and more from verified Indian suppliers.",
    url: "/categories",
  },
}

function categoryImageUrl(path: string | null) {
  if (!path) return null
  return publicTransformedImageUrl("category_images", path, { width: 640 })
}

async function CategoriesSummary() {
  const categories = await getCachedMegaMenuCategories()
  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0)

  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {categories.length} categor
      {categories.length === 1 ? "y" : "ies"} ·{" "}
      {totalProducts.toLocaleString("en-IN")} products from verified suppliers
    </p>
  )
}

async function CategoryGrid() {
  const categories = await getCachedMegaMenuCategories()

  if (categories.length === 0) {
    return (
      <div className="py-16">
        <Empty>
          <EmptyTitle>No categories yet</EmptyTitle>
          <EmptyDescription>
            Categories appear here as they are created.
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
    )
  }

  return (
    <div className={CATEGORY_GRID}>
      {categories.map((cat, index) => (
        <Card
          key={cat.id}
          className="group h-full !gap-0 overflow-hidden border-border !py-0 transition-shadow [--card-spacing:--spacing(3)] hover:shadow-md"
        >
          <Link href={`/category/${cat.slug}`} className="block press">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
              <ProductImage
                src={categoryImageUrl(cat.image_path)}
                alt=""
                priority={index < 4}
                sizes={CATEGORY_IMAGE_SIZES}
              />
            </div>

            <CardHeader className="gap-1 pt-2.5">
              <CardTitle className="flex items-start justify-between gap-2 text-sm leading-snug font-semibold tracking-tight">
                <span className="line-clamp-2">{cat.name}</span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </CardTitle>
              <CardDescription className="text-xs">
                {cat.product_count} product
                {cat.product_count === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
          </Link>

          {cat.subcategories.length > 0 ? (
            <CardContent className="mt-auto pt-2.5 pb-3">
              <div className="flex flex-wrap gap-1">
                {cat.subcategories.map((sub) => (
                  <Button
                    key={sub.id}
                    variant="outline"
                    size="xs"
                    nativeButton={false}
                    render={<Link href={`/category/${sub.slug}`} />}
                    className="rounded-sm px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {sub.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  )
}

export default function CategoriesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Categories</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Marketplace
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Browse categories
          </h1>
          {/* Counts need the same category read as the grid, so they stream in
              with it instead of holding up the heading and controls. */}
          <Suspense fallback={<Skeleton className="mt-1 h-5 w-80 max-w-full" />}>
            <CategoriesSummary />
          </Suspense>
        </div>

        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/products" />}
        >
          All products
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            data-icon="inline-end"
          />
        </Button>
      </div>
      <Separator className="mb-5" />

      <Suspense fallback={<CategoryPageGridSkeleton />}>
        <CategoryGrid />
      </Suspense>
    </div>
  )
}
