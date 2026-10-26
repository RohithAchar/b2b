"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { cn } from "cn"

/**
 * Recent search chips shared by the mega-menu (desktop + hero) and the mobile
 * search sheet. Terms link to the same `/products?q=` contract as a submit.
 */
export function RecentSearches({
  searches,
  onSelect,
  onClear,
  className,
}: {
  searches: string[]
  onSelect?: (term: string) => void
  onClear?: () => void
  className?: string
}) {
  if (searches.length === 0) return null

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Recent searches"
    >
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
        <HugeiconsIcon
          icon={Clock01Icon}
          strokeWidth={2}
          className="size-3.5"
        />
        Recent:
      </span>
      {searches.map((term) => (
        <Link
          key={term}
          href={`/products?q=${encodeURIComponent(term)}`}
          onClick={() => onSelect?.(term)}
          className="inline-flex h-8 max-w-full shrink-0 items-center rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <span className="max-w-36 truncate">{term}</span>
        </Link>
      ))}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear recent searches"
          className="shrink-0 px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  )
}
