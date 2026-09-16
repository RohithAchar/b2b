"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Menu01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOut } from "@/lib/auth/actions";

type User = { email: string; user_type: string } | null;
type NavCategory = { slug: string; name: string };

function dashboardHref(userType: string): string {
  if (userType === "admin") return "/admin/dashboard";
  if (userType === "supplier") return "/supplier/dashboard";
  return "/";
}

const NAV_LINKS = [
  { label: "Categories", href: "/products" },
  { label: "Suppliers", href: "/products" },
  { label: "Wholesale Deals", href: "/products" },
  { label: "New Arrivals", href: "/products" },
];

export function StorefrontHeader({
  user,
  categories = [],
}: {
  user: User;
  categories?: NavCategory[];
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/products?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      {/* ---- Tier 1: logo + nav + actions ---- */}
      <div className="border-b border-border">
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-4">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger
              render={<Button variant="ghost" size="icon-sm" className="lg:hidden" />}
            >
              <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle>B2B Marketplace</SheetTitle>
              <nav className="mt-6 flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                  >
                    {cat.name}
                  </Link>
                ))}
                <div className="mt-4 border-t border-border pt-4">
                  {user ? (
                    <>
                      <Link
                        href={dashboardHref(user.user_type)}
                        className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        Dashboard
                      </Link>
                      <form action={signOut}>
                        <button
                          type="submit"
                          className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                        >
                          Sign out
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/login"
                        className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/supplier/onboarding"
                        className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        Become a Supplier
                      </Link>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>

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
              <>
                <Link
                  href={dashboardHref(user.user_type)}
                  className="hidden md:block"
                >
                  <Button variant="outline" size="sm">
                    Dashboard
                  </Button>
                </Link>
                <form action={signOut} className="hidden md:block">
                  <Button variant="ghost" size="sm" type="submit">
                    Sign out
                  </Button>
                </form>
              </>
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
          <form
            onSubmit={handleSearch}
            className="flex w-full items-center gap-2"
          >
            <div className="relative flex-1">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
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