"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useStorefrontCategories } from "@/components/layout/storefront-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FilterIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"


export function buildCategoryLink(query: string, slug: string, imageToken = "") {
  const sp = new URLSearchParams()
  sp.set("category", slug)
  if (query) sp.set("q", query)
  if (imageToken) sp.set("img", imageToken)
  return `/products?${sp.toString()}`
}

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "moq_asc", label: "MOQ: Low to High" },
] as const

export function ProductsFilterBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categories = useStorefrontCategories()
  const query = searchParams.get("q") ?? ""
  const categorySlug = searchParams.get("category") ?? ""
  const sort = searchParams.get("sort") ?? "relevance"
  const minPrice = searchParams.get("minPrice") ?? undefined
  const maxPrice = searchParams.get("maxPrice") ?? undefined
  const minMoq = searchParams.get("minMoq") ?? undefined
  const maxMoq = searchParams.get("maxMoq") ?? undefined
  const inStock = searchParams.get("inStock") === "true"
  const negotiable = searchParams.get("negotiable") === "true"
  const sampleAvailable = searchParams.get("sampleAvailable") === "true"
  const imageToken = searchParams.get("img") ?? ""

  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount = [
    minPrice,
    maxPrice,
    minMoq,
    maxMoq,
    inStock ? "inStock" : "",
    negotiable ? "negotiable" : "",
    sampleAvailable ? "sampleAvailable" : "",
  ].filter(Boolean).length

  const buildUrl = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    if (query) sp.set("q", query)
    if (categorySlug) sp.set("category", categorySlug)
    const finalSort = overrides.sort ?? sort
    if (finalSort !== "relevance") sp.set("sort", finalSort)
    const finalMinPrice = overrides.minPrice ?? minPrice
    if (finalMinPrice) sp.set("minPrice", finalMinPrice)
    const finalMaxPrice = overrides.maxPrice ?? maxPrice
    if (finalMaxPrice) sp.set("maxPrice", finalMaxPrice)
    const finalMinMoq = overrides.minMoq ?? minMoq
    if (finalMinMoq) sp.set("minMoq", finalMinMoq)
    const finalMaxMoq = overrides.maxMoq ?? maxMoq
    if (finalMaxMoq) sp.set("maxMoq", finalMaxMoq)
    const finalInStock = overrides.inStock ?? (inStock ? "true" : undefined)
    if (finalInStock === "true") sp.set("inStock", "true")
    const finalNegotiable = overrides.negotiable ?? (negotiable ? "true" : undefined)
    if (finalNegotiable === "true") sp.set("negotiable", "true")
    const finalSampleAvailable = overrides.sampleAvailable ?? (sampleAvailable ? "true" : undefined)
    if (finalSampleAvailable === "true") sp.set("sampleAvailable", "true")
    // Image search is a candidate pool, so it rides along with every filter.
    if (imageToken) sp.set("img", imageToken)
    sp.set("page", "1")
    return `/products?${sp.toString()}`
  }

  const clearAllUrl = () => {
    const sp = new URLSearchParams()
    if (query) sp.set("q", query)
    if (categorySlug) sp.set("category", categorySlug)
    return `/products?${sp.toString()}`
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      {/* Searching happens in the storefront header on desktop and the mobile
          bottom-nav sheet on small screens. This bar only narrows results. */}

      {/* Image-search mode banner */}
      {imageToken && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
          <p className="text-sm text-foreground">
            Showing products visually similar to your uploaded image.
          </p>
          <Link
            href={clearAllUrl()}
            className="shrink-0 text-xs font-medium text-primary hover:underline"
          >
            Clear image search
          </Link>
        </div>
      )}

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={categorySlug ? "outline" : "default"}
          size="sm"
          nativeButton={false}
          className="h-7 rounded-sm text-xs"
          render={
            <Link
              href={
                query ? `/products?q=${encodeURIComponent(query)}` : "/products"
              }
            />
          }
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={categorySlug === cat.slug ? "default" : "outline"}
            size="sm"
            nativeButton={false}
            className="h-7 rounded-sm text-xs"
            render={<Link href={buildCategoryLink(query, cat.slug, imageToken)} />}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Sort + Filter toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={sort}
          onValueChange={(value) => {
            router.push(buildUrl({ sort: value ?? undefined }))
          }}
        >
          <SelectTrigger className="h-8 w-44 rounded-md text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filtersOpen || activeFilterCount > 0 ? "default" : "outline"}
          size="sm"
          className="h-8 rounded-md text-xs"
          onClick={() => setFiltersOpen(!filtersOpen)}
          aria-expanded={filtersOpen}
        >
          <HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="size-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 rounded-sm bg-primary-foreground px-1 text-[10px] font-bold text-primary">
              {activeFilterCount}
            </span>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-md text-xs text-muted-foreground"
            render={<Link href={clearAllUrl()} />}
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Min Price
              </label>
              <Input
                type="number"
                min={0}
                placeholder="Min price"
                className="h-8 rounded-md text-xs"
                defaultValue={minPrice}
                onBlur={(e) => {
                  if (e.target.value !== minPrice) {
                    window.location.href = buildUrl({ minPrice: e.target.value || undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = e.currentTarget.value || undefined
                    window.location.href = buildUrl({ minPrice: val })
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Max Price
              </label>
              <Input
                type="number"
                min={0}
                placeholder="Max price"
                className="h-8 rounded-md text-xs"
                defaultValue={maxPrice}
                onBlur={(e) => {
                  if (e.target.value !== maxPrice) {
                    window.location.href = buildUrl({ maxPrice: e.target.value || undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = e.currentTarget.value || undefined
                    window.location.href = buildUrl({ maxPrice: val })
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Min MOQ
              </label>
              <Input
                type="number"
                min={1}
                placeholder="Min MOQ"
                className="h-8 rounded-md text-xs"
                defaultValue={minMoq}
                onBlur={(e) => {
                  if (e.target.value !== minMoq) {
                    window.location.href = buildUrl({ minMoq: e.target.value || undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = e.currentTarget.value || undefined
                    window.location.href = buildUrl({ minMoq: val })
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Max MOQ
              </label>
              <Input
                type="number"
                min={1}
                placeholder="Max MOQ"
                className="h-8 rounded-md text-xs"
                defaultValue={maxMoq}
                onBlur={(e) => {
                  if (e.target.value !== maxMoq) {
                    window.location.href = buildUrl({ maxMoq: e.target.value || undefined })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const val = e.currentTarget.value || undefined
                    window.location.href = buildUrl({ maxMoq: val })
                  }
                }}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => {
                  window.location.href = buildUrl({ inStock: e.target.checked ? "true" : undefined })
                }}
                className="size-3.5 rounded-sm border-border"
              />
              In stock only
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={negotiable}
                onChange={(e) => {
                  window.location.href = buildUrl({ negotiable: e.target.checked ? "true" : undefined })
                }}
                className="size-3.5 rounded-sm border-border"
              />
              Price negotiable
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sampleAvailable}
                onChange={(e) => {
                  window.location.href = buildUrl({ sampleAvailable: e.target.checked ? "true" : undefined })
                }}
                className="size-3.5 rounded-sm border-border"
              />
              Sample available
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
