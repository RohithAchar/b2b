import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

function CategoriesSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} className="border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-7 w-20 rounded-sm" />
              <Skeleton className="h-7 w-24 rounded-sm" />
              <Skeleton className="h-7 w-16 rounded-sm" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {categories.map((cat) => (
        <Card key={cat.id} className="border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              {cat.image_path ? (
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={publicTransformedImageUrl(
                      "category_images",
                      cat.image_path,
                      { width: 200 },
                    )}
                    alt={cat.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate">{cat.name}</CardTitle>
                <CardDescription>
                  <Badge variant="secondary" className="mt-1">
                    {cat.product_count} product
                    {cat.product_count === 1 ? "" : "s"}
                  </Badge>
                </CardDescription>
              </div>
            </div>
            <CardAction>
              <Button
                variant="link"
                size="sm"
                nativeButton={false}
                render={<Link href={`/category/${cat.slug}`} />}
                className="h-7 text-sm font-semibold text-primary"
              >
                View all
                <span aria-hidden>→</span>
              </Button>
            </CardAction>
          </CardHeader>
          {cat.subcategories.length > 0 ? (
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {cat.subcategories.map((sub) => (
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
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  )
}

export default async function CategoriesPage() {
  const categories = await getCachedMegaMenuCategories()
  const totalProducts = categories.reduce(
    (sum, c) => sum + c.product_count,
    0,
  )

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

      <div className="mb-5 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Browse Categories
        </h1>
        <p className="text-sm text-muted-foreground">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
          {totalProducts.toLocaleString("en-IN")} products from verified
          suppliers
        </p>
      </div>
      <Separator className="mb-5" />

      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoryGrid />
      </Suspense>
    </div>
  )
}
