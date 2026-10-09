"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Store01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageSearchButton } from "@/components/storefront/image-search-button"
import { SearchSuggestionsDropdown } from "@/components/storefront/search-suggestions"
import { useSearchSuggestions } from "@/components/storefront/use-search-suggestions"

/**
 * The storefront search bar.
 *
 * Used by the header's search tier, the sticky mini-search, and the mobile
 * bottom-nav sheet — the only places a shopper searches from — so image
 * search is reachable from every search entry point rather than only one of
 * them. Typing shows live product + category suggestions from
 * `/api/search/suggest`; submitting keeps the native GET form contract
 * (`/products?q=` + `page=1`).
 *
 * The file is a client component because `ImageSearchButton` opens a file
 * picker and navigates, and suggestions need controlled input state.
 */
export function StorefrontSearchForm({
  autoFocus = false,
  showBrowseAll = false,
}: {
  autoFocus?: boolean
  showBrowseAll?: boolean
}) {
  const [value, setValue] = useState("")
  const [open, setOpen] = useState(false)
  const listId = useId()
  const { products, categories, hasResults } = useSearchSuggestions(
    open ? value : "",
  )
  const showDropdown = open && hasResults

  return (
    <form
      action="/products"
      method="get"
      onSubmit={() => setOpen(false)}
      className="flex w-full items-center gap-2"
    >
      <input type="hidden" name="page" value="1" />
      <div
        className="relative flex-1"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOpen(false)
          }
        }}
      >
        <Input
          name="q"
          value={value}
          autoFocus={autoFocus}
          placeholder="Search products, suppliers, brands or categories..."
          autoComplete="off"
          aria-expanded={showDropdown}
          aria-controls={listId}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false)
          }}
          className="h-10 border-border bg-card pl-9 shadow-none"
        />
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="size-4"
          />
        </span>
        {showDropdown && (
          <SearchSuggestionsDropdown
            products={products}
            categories={categories}
            listId={listId}
          />
        )}
      </div>
      <ImageSearchButton />
      <Button type="submit" size="lg" className="shrink-0 px-6">
        Search
      </Button>
      {showBrowseAll && (
        <Button
          variant="ghost"
          size="lg"
          type="button"
          className="hidden shrink-0 text-primary xl:inline-flex"
          render={<Link href="/products" />}
          nativeButton={false}
        >
          <HugeiconsIcon icon={Store01Icon} strokeWidth={2} />
          Browse All
        </Button>
      )}
    </form>
  )
}
