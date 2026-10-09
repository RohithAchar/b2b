"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { StorefrontSearchForm } from "@/components/storefront/storefront-search-form"

const ANCHOR_SELECTOR = "[data-mini-search-anchor]"
const SCROLL_THRESHOLD = 120

function MiniSearchBar() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const anchor = document.querySelector(ANCHOR_SELECTOR)
    if (anchor) {
      const observer = new IntersectionObserver(
        ([entry]) => setVisible(!entry.isIntersecting),
        // Shrink the root by the sticky header height so the bar appears
        // exactly when the hero search slides under the header.
        { rootMargin: "-48px 0px 0px 0px" }
      )
      observer.observe(anchor)
      return () => observer.disconnect()
    }
    const onScroll = () => setVisible(window.scrollY > SCROLL_THRESHOLD)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        "fixed inset-x-0 top-12 z-40 border-b border-border bg-card transition-[transform,visibility] duration-200 ease-out motion-reduce:transition-none",
        visible ? "visible translate-y-0" : "invisible -translate-y-full"
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-2">
        <StorefrontSearchForm />
      </div>
    </div>
  )
}

/**
 * Minimal sticky search bar for browsing pages.
 *
 * Rendered by `StorefrontShell` on `/`, `/products`, `/categories`,
 * `/category/*` and `/products/*` (never account/cart). It stays hidden while a page-level
 * search is on screen: on the homepage an `IntersectionObserver` watches the
 * hero search (marked with `data-mini-search-anchor`); pages without an
 * anchor fall back to a small scroll threshold. Reuses `StorefrontSearchForm`
 * unchanged so the search contract stays identical everywhere. Keyed by
 * pathname so visibility state resets on navigation.
 */
export function StorefrontMiniSearch() {
  const pathname = usePathname()

  const enabled =
    pathname === "/" ||
    pathname === "/products" ||
    pathname === "/categories" ||
    pathname.startsWith("/products/") ||
    pathname.startsWith("/category/")

  if (!enabled) return null

  return <MiniSearchBar key={pathname} />
}
