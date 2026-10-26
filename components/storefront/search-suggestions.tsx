"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { addRecentSearch } from "@/lib/recent-searches"
import type { SuggestCategory, SuggestProduct } from "@/lib/search-suggest"

/**
 * Shared live-suggestion dropdown for the storefront search bars.
 *
 * Row markup mirrors the existing `SearchMegaMenu` suggestion list so both
 * search entry points read identically. `variant="hero"` keeps the mega menu's
 * 2px primary border treatment; `variant="plain"` fits the mobile sheet bar.
 */
export function SearchSuggestionsDropdown({
  products,
  categories,
  listId,
  variant = "plain",
  inline = false,
}: {
  products: SuggestProduct[]
  categories: SuggestCategory[]
  listId: string
  variant?: "plain" | "hero"
  /**
   * Render in flow instead of as an absolute dropdown. The mobile search
   * sheet uses this so results grow the sheet upward instead of being clipped
   * at the bottom of the screen by the keyboard.
   */
  inline?: boolean
}) {
  return (
    <div
      id={listId}
      className={cn(
        "overflow-hidden bg-card shadow-md",
        inline
          ? "relative mt-1 rounded-md border border-border"
          : cn(
              "absolute inset-x-0 top-full z-50",
              variant === "hero"
                ? "rounded-b-md border-2 border-t-0 border-primary"
                : "mt-1 rounded-md border border-border"
            )
      )}
    >
      <ul className="flex max-h-64 flex-col overflow-y-auto py-1">
        {categories.map((c) => (
          <li key={`category-${c.id}`}>
            <Link
              href={`/category/${c.slug}`}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/85 hover:bg-muted"
            >
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {c.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                Category
              </span>
            </Link>
          </li>
        ))}
        {products.map((p) => (
          <li key={`product-${p.id}`}>
            <Link
              href={`/products?q=${encodeURIComponent(p.title)}`}
              onClick={() => addRecentSearch(p.title)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/85 hover:bg-muted"
            >
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {p.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
