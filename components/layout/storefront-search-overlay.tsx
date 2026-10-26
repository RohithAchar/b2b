"use client"

import { useEffect, useState } from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  SearchMegaMenu,
  type MegaMenuCategory,
} from "@/components/storefront/search-mega-menu"
import { TRENDING_SEARCHES } from "@/lib/search-suggest"

/**
 * Desktop search entry point.
 *
 * A top-bar icon opens the same mega menu used by the homepage hero, but as a
 * full-width panel directly below the header. The page behind it is blurred
 * and dimmed, so search never pushes the page content down or requires
 * scrolling back to the hero. Mobile keeps the bottom-nav search sheet.
 */
export function StorefrontSearchOverlay({
  categories,
}: {
  categories: MegaMenuCategory[]
}) {
  const [open, setOpen] = useState(false)

  // The dialog traps focus but intentionally allows pointer interaction
  // outside (so the header stays usable); lock page scroll while it is open.
  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth
    body.style.overflow = "hidden"
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }
    return () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
    }
  }, [open])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen} modal="trap-focus">
      <DialogPrimitive.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search"
            className="hidden text-foreground/80 lg:inline-flex"
          />
        }
      >
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-5" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="storefront-search-backdrop"
          className="fixed inset-x-0 top-(--storefront-header-offset) bottom-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-200 ease-(--motion-settle) data-ending-style:opacity-0 data-starting-style:opacity-0"
        />
        <DialogPrimitive.Popup
          data-slot="storefront-search-popup"
          className="fixed inset-x-0 top-(--storefront-header-offset) z-40 max-h-[calc(100dvh-var(--storefront-header-offset))] overflow-y-auto border-b border-border bg-card shadow-lg transition duration-200 ease-(--motion-settle) outline-none data-ending-style:-translate-y-2 data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0"
          onClick={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("a[href]")
            ) {
              setOpen(false)
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Search products
          </DialogPrimitive.Title>
          <SearchMegaMenu
            categories={categories}
            trending={TRENDING_SEARCHES}
            autoFocus
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
