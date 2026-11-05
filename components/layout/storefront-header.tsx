"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BellIcon,
  FavouriteIcon,
  Search01Icon,
  ShoppingCart01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { navLinksFor } from "@/lib/nav"
import { AccountMenu } from "@/components/layout/account-menu"
import { CartIconLink } from "@/components/storefront/cart-icon-link"
import { Button } from "@/components/ui/button"

type User = { email: string; user_type: string; isStaff?: boolean } | null

const PARTNER_TABS = [
  { label: "D2H Core", active: true },
  { label: "D2H Select" },
  { label: "ECom Package" },
  { label: "Dropship Deals" },
]

export function StorefrontHeader({
  user,
  categories = [],
  megaCategories = [],
  cartCount = 0,
}: {
  user: User
  categories?: { slug: string; name: string }[]
  megaCategories?: { id: string; name: string; slug: string; image_path: string | null; product_count: number }[]
  cartCount?: number
}) {
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navLinks = navLinksFor(user)

  return (
    <header
      data-scrolled={scrolled}
      className="scroll-edge sticky top-0 z-50 hidden bg-card pt-(--safe-area-top) lg:block"
    >
      <div className="mx-auto flex h-[82px] max-w-7xl items-center gap-4 px-6 xl:px-10">
        {/* Brand logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            D
          </span>
          <span className="text-lg font-bold tracking-tight">D2B</span>
        </Link>

        {/* Partner / store logos */}
        <div className="flex shrink-0 items-center gap-2">
          {PARTNER_TABS.map((tab) => (
            <span
              key={tab.label}
              className={
                tab.active
                  ? "flex h-9 items-center rounded-md border border-primary bg-primary/5 px-3 text-sm font-semibold text-brand-700"
                  : "flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground"
              }
            >
              {tab.label}
            </span>
          ))}
        </div>

        {/* Vertical divider */}
        <span className="h-8 w-px shrink-0 bg-border" aria-hidden="true" />

        {/* Search */}
        <form
          action="/products"
          method="get"
          className="flex min-w-0 flex-1 items-stretch rounded-md border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        >
          <input type="hidden" name="page" value="1" />
          <input
            name="q"
            type="search"
            placeholder="Search products, categories..."
            className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex items-center px-3 text-muted-foreground hover:text-primary"
          >
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-5" />
          </button>
        </form>

        {/* Super Pi */}
        <button
          type="button"
          title="Coming soon"
          className="shrink-0 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground"
        >
          Super Pi
        </button>

        {/* Header actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/account"
            aria-label="Notifications"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HugeiconsIcon icon={BellIcon} strokeWidth={2} className="size-5" />
          </Link>
          <Link
            href="/account?tab=saved"
            aria-label="Wishlist"
            className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HugeiconsIcon icon={FavouriteIcon} strokeWidth={2} className="size-5" />
          </Link>
          <CartIconLink count={cartCount} />
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <Link href="/auth/login">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
