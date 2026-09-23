"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useStorefrontCategories } from "@/components/layout/storefront-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export function buildPageUrl(query: string, categorySlug: string, p: number) {
  const sp = new URLSearchParams()
  if (query) sp.set("q", query)
  if (categorySlug) sp.set("category", categorySlug)
  sp.set("page", String(p))
  return `/products?${sp.toString()}`
}

export function buildCategoryLink(query: string, slug: string) {
  const sp = new URLSearchParams()
  sp.set("category", slug)
  if (query) sp.set("q", query)
  return `/products?${sp.toString()}`
}

export function ProductsFilterBar() {
  const searchParams = useSearchParams()
  const categories = useStorefrontCategories()
  const query = searchParams.get("q") ?? ""
  const categorySlug = searchParams.get("category") ?? ""

  return (
    <div className="mb-4 flex flex-col gap-3">
      <form action="/products" method="get" className="flex gap-2">
        {categorySlug && (
          <input type="hidden" name="category" value={categorySlug} />
        )}
        <input type="hidden" name="page" value="1" />
        <div className="relative flex-1">
          <Input
            name="q"
            defaultValue={query}
            placeholder="Search products, suppliers or brands..."
            className="h-10 pr-9"
          />
          <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </span>
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={
            query ? `/products?q=${encodeURIComponent(query)}` : "/products"
          }
        >
          <Button
            variant={categorySlug ? "outline" : "default"}
            size="sm"
            nativeButton={false}
            className="h-7 rounded-sm text-xs"
          >
            All
          </Button>
        </Link>
        {categories.map((cat) => (
          <Link key={cat.id} href={buildCategoryLink(query, cat.slug)}>
            <Button
              variant={categorySlug === cat.slug ? "default" : "outline"}
              size="sm"
              nativeButton={false}
              className="h-7 rounded-sm text-xs"
            >
              {cat.name}
            </Button>
          </Link>
        ))}
      </div>
    </div>
  )
}
