"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { StorefrontHeader } from "@/components/layout/storefront-header"
import { StorefrontFooter } from "@/components/layout/storefront-footer"
import { StorefrontBottomNav } from "@/components/layout/storefront-bottom-nav"
import { StorefrontSession } from "@/components/storefront/storefront-session"
import type { MegaMenuCategory } from "@/components/storefront/search-mega-menu"

type User = { email: string; user_type: string; isStaff?: boolean } | null
type NavCategory = { slug: string; name: string }

export function StorefrontShell({
  user,
  categories,
  megaCategories,
  cartCount = 0,
  children,
}: {
  user: User
  categories?: NavCategory[]
  megaCategories?: MegaMenuCategory[]
  cartCount?: number
  children: ReactNode
}) {
  const pathname = usePathname()
  // Hide the bottom nav (and its reserved padding) on product detail pages.
  const hideBottomNav = /^\/products\/[^/]+$/.test(pathname ?? "")

  return (
    <div
      className={
        hideBottomNav
          ? "flex min-h-screen flex-col lg:pb-0"
          : "flex min-h-screen flex-col pb-(--bottom-nav-offset) lg:pb-0"
      }
    >
      <StorefrontSession />
      <StorefrontHeader
        user={user}
        categories={categories}
        megaCategories={megaCategories}
        cartCount={cartCount}
      />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      {!hideBottomNav && <StorefrontBottomNav user={user} />}
    </div>
  )
}
