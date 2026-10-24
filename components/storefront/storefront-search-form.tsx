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
      className="flex w-full items-stretch gap-2"
    >
      <input type="hidden" name="page" value="1" />
      <div
        className="relative min-w-0 flex-1"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOpen(false)
          }
        }}
      >
        <div className="flex items-stretch rounded-md border border-border bg-card transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
          <span className="flex shrink-0 items-center pl-3 text-muted-foreground">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </span>
          <Input
            name="q"
            aria-label="Search products"
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
            className="h-10 min-w-0 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
          />
          <span className="flex shrink-0 items-stretch border-l border-border">
            <ImageSearchButton className="h-full rounded-r-md border-0 bg-transparent px-3 shadow-none hover:bg-muted/60" />
          </span>
        </div>
        {showDropdown && (
          <SearchSuggestionsDropdown
            products={products}
            categories={categories}
            listId={listId}
          />
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        aria-label="Search"
        className="shrink-0 px-6 max-sm:px-3"
      >
        <HugeiconsIcon
          icon={Search01Icon}
          strokeWidth={2.5}
          className="size-4 sm:hidden"
        />
        <span className="max-sm:sr-only">Search</span>
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
