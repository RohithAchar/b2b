import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { NAV_LINKS } from "@/lib/nav";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type User = { email: string; user_type: string } | null;
type NavCategory = { slug: string; name: string };

export function StorefrontHeader({
  user,
  categories = [],
}: {
  user: User;
  categories?: NavCategory[];
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      {/* ---- Tier 1: logo + nav + actions ---- */}
      <div className="border-b border-border">
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

          {/* Right actions */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user ? (
              <AccountMenu user={user} />
            ) : (
              <>
                <Link
                  href="/supplier/onboarding"
                  className="hidden md:block"
                >
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

      {/* ---- Tier 2: search ---- */}
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5">
          <form action="/products" method="get" className="flex w-full items-center gap-2">
            <input type="hidden" name="page" value="1" />
            <div className="relative flex-1">
              <Input
                name="q"
                placeholder="Search products, suppliers, brands or categories..."
                className="h-10 border-border bg-card pl-9 shadow-none"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
              </span>
            </div>
            <Button type="submit" size="lg" className="shrink-0 px-6">
              Search
            </Button>
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
          </form>
        </div>
      </div>

      {/* ---- Tier 3: category rail ---- */}
      {categories.length > 0 && (
        <div className="bg-card">
          <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-4 py-1.5">
            <Link
              href="/products"
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              All Categories
            </Link>
            <span className="mx-1 shrink-0 text-border">|</span>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-foreground/75 hover:bg-muted hover:text-foreground"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}