import Link from "next/link"
import { NAV_LINKS } from "@/lib/nav"
import { AccountMenu } from "@/components/layout/account-menu"
import { MobileNav } from "@/components/layout/mobile-nav"
import { CartIconLink } from "@/components/storefront/cart-icon-link"
import { Button } from "@/components/ui/button"

type User = { email: string; user_type: string } | null
type NavCategory = { slug: string; name: string }

export function StorefrontHeader({
  user,
  categories = [],
  cartCount = 0,
}: {
  user: User
  categories?: NavCategory[]
  cartCount?: number
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      {/* ---- Tier 1: logo + nav + actions ---- */}      <div className="border-b border-border">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-4">
          {/* Mobile menu */}
          <MobileNav user={user} categories={categories} />

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              B
            </span>
            <span className="text-base font-bold tracking-tight">
              B2B Marketplace
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV_LINKS.map((link) => (
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
          <CartIconLink count={cartCount} className="ml-auto lg:hidden" />

          {/* Right actions (desktop; mobile uses the bottom navigation) */}
          <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
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
