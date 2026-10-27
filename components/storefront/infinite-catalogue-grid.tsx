"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { loadCataloguePage } from "@/lib/catalogue-actions"
import type { CatalogueFilters } from "@/lib/catalogue"
import type { CataloguePage } from "@/lib/storefront"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  ProductCard,
  type ProductCardData,
} from "@/components/storefront/product-card"

type GridStatus = "idle" | "loading" | "error" | "complete"

const GRID_CLASS =
  "grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 min-[1200px]:grid-cols-5 min-[1440px]:grid-cols-6"

export function InfiniteCatalogueGrid({
  initialPage,
  filters,
}: {
  initialPage: CataloguePage
  filters: CatalogueFilters
}) {
  const [items, setItems] = useState(initialPage.items)
  const [cursor, setCursor] = useState(initialPage.nextCursor)
  const [status, setStatus] = useState<GridStatus>(
    initialPage.nextCursor ? "idle" : "complete",
  )
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestRef = useRef(0)
  const inFlightRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (!cursor || inFlightRef.current || status === "complete") return

    inFlightRef.current = true
    const requestId = ++requestRef.current
    setStatus("loading")
    setError(null)

    try {
      const result = await loadCataloguePage(filters, cursor)
      if (requestId !== requestRef.current) return

      if (!result.ok) {
        setStatus("error")
        setError(result.message)
        return
      }

      setItems((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [
          ...current,
          ...result.page.items.filter((item) => !seen.has(item.id)),
        ]
      })
      setCursor(result.page.nextCursor)
      setStatus(result.page.nextCursor ? "idle" : "complete")
    } catch {
      if (requestId !== requestRef.current) return
      setStatus("error")
      setError("Could not load more products. Check your connection and try again.")
    } finally {
      inFlightRef.current = false
    }
  }, [cursor, filters, status])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !cursor || status === "loading" || status === "complete") {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: "600px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [cursor, loadMore, status])

  if (items.length === 0) {
    return (
      <div className="py-16">
        <Empty>
          <EmptyTitle>No products found</EmptyTitle>
          <EmptyDescription>
            Try a different search or clear some filters.
          </EmptyDescription>
        </Empty>
      </div>
    )
  }

  return (
    <div aria-busy={status === "loading"}>
      <div className={GRID_CLASS}>
        {items.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product as ProductCardData}
            priority={index < 2}
            sizes="(min-width: 1440px) 13vw, (min-width: 1200px) 15vw, (min-width: 1024px) 18vw, (min-width: 768px) 30vw, 46vw"
          />
        ))}
      </div>

      <div ref={sentinelRef} className="flex min-h-16 items-center justify-center py-6">
        {status === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              strokeWidth={2}
              className="size-4 animate-spin"
            />
            Loading more products
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadMore()}>
              Try again
            </Button>
          </div>
        ) : status === "idle" ? (
          <Button variant="outline" onClick={() => void loadMore()}>
            Load more products
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            You have reached the end of the catalogue.
          </p>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {status === "loading"
          ? "Loading more products."
          : status === "error"
            ? error
            : status === "complete"
              ? "All products loaded."
              : ""}
      </p>
    </div>
  )
}
