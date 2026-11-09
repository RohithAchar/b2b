"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { StorefrontHeader } from "@/components/layout/storefront-header"
import { StorefrontFooter } from "@/components/layout/storefront-footer"
import { StorefrontBottomNav } from "@/components/layout/storefront-bottom-nav"
import { StoreTabs } from "@/components/storefront/store-tabs"
import { StorefrontSession } from "@/components/storefront/storefront-session"
import type { MegaMenuCategory } from "@/components/storefront/search-mega-menu"
import type { ActiveStore } from "@/lib/store-context"

type User = { email: string; user_type: string; isStaff?: boolean } | null
type NavCategory = { slug: string; name: string }

export function StorefrontShell({
  user,
  categories,
  megaCategories,
  cartCount = 0,
  activeStore,
  activeStores,
  children,
}: {
  user: User
  categories?: NavCategory[]
  megaCategories?: MegaMenuCategory[]
  cartCount?: number
  activeStore: ActiveStore | null
  activeStores: ActiveStore[]
  children: ReactNode
}) {
  const pathname = usePathname()
  // Hide the bottom nav (and its reserved padding) on product detail pages
  // and on the D2H Select page and its sub-routes.
  const hideBottomNav =
    /^\/products\/[^/]+$/.test(pathname ?? "") ||
    /^\/select(\/|$)/.test(pathname ?? "")

  return (
    <div
      className={
        hideBottomNav
          ? "flex min-h-screen flex-col lg:pb-0"
          : "flex min-h-screen flex-col pb-(--bottom-nav-offset) lg:pb-0"
      }
    >
      <StorefrontSession />
      {pathname === "/" || pathname === "/select" || pathname?.startsWith("/select/") ? (
        <StoreTabs />
      ) : null}
      <StorefrontHeader
        user={user}
        categories={categories}
        megaCategories={megaCategories}
        cartCount={cartCount}
        activeStore={activeStore}
        activeStores={activeStores}
      />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      {!hideBottomNav && (
        <StorefrontBottomNav user={user} cartCount={cartCount} />
      )}
    </div>
  )
}
