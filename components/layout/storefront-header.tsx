"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { navLinksFor } from "@/lib/nav"
import { AccountMenu } from "@/components/layout/account-menu"
import { MobileNav } from "@/components/layout/mobile-nav"
import { StorefrontSearchOverlay } from "@/components/layout/storefront-search-overlay"
import { CartIconLink } from "@/components/storefront/cart-icon-link"
import type { MegaMenuCategory } from "@/components/storefront/search-mega-menu"
import { Button } from "@/components/ui/button"

type User = { email: string; user_type: string; isStaff?: boolean } | null
type NavCategory = { slug: string; name: string }

/** Scroll distance before the header's content-boundary fade appears. */
const SCROLL_THRESHOLD = 10

export function StorefrontHeader({
  user,
  categories = [],
  megaCategories = [],
  cartCount = 0,
}: {
  user: User
  categories?: NavCategory[]
  megaCategories?: MegaMenuCategory[]
  cartCount?: number
}) {
  const [scrolled, setScrolled] = useState(false)
  const navLinks = navLinksFor(user)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Remount the overlay on navigation so an open panel can never stay over the
  // next route/query without an extra state-sync effect.
  const routeKey = `${pathname}?${searchParams.toString()}`

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      data-scrolled={scrolled}
      className="scroll-edge sticky top-0 z-50 bg-card pt-(--safe-area-top)"
    >
      {/* ---- Tier 1: logo + nav + actions ---- */}{" "}
      <div>
        <div className="mx-auto flex h-(--storefront-header-height) max-w-7xl items-center gap-2 px-4">
          {/* Mobile menu */}
          <MobileNav user={user} categories={categories} />

          {/* Logo */}
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              B
            </span>
            <span className="truncate text-base font-bold tracking-tight">
              B2B Marketplace
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Cart (mobile; desktop has it in right actions) */}
          <CartIconLink count={cartCount} className="ml-auto size-10 lg:hidden" />

          {/* Right actions (desktop; mobile uses the bottom navigation) */}
          <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
            <StorefrontSearchOverlay
              key={routeKey}
              categories={megaCategories}
            />
            <CartIconLink count={cartCount} />
            {user ? (
              <AccountMenu user={user} />
            ) : (
              <>
                <Link href="/supplier/onboarding" className="hidden md:block">
                  <Button variant="secondary" size="sm">
                    Become a Supplier
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button size="sm">Sign In</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
