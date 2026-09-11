"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
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

function dashboardHref(userType: string): string {
  if (userType === "admin") return "/admin/dashboard";
  if (userType === "supplier") return "/supplier/dashboard";
  return "/";
}

export function StorefrontHeader({ user }: { user: User }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) router.push(`/products?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="md:hidden" />}
          >
            <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
          </SheetTrigger>
          <SheetContent side="left">
            <SheetTitle>Menu</SheetTitle>
            <nav className="mt-8 flex flex-col gap-2">
              <Link
                href="/"
                className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              >
                Home
              </Link>
              <Link
                href="/products"
                className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
              >
                All Products
              </Link>
              {user ? (
                <>
                  <Link
                    href={dashboardHref(user.user_type)}
                    className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    Dashboard
                  </Link>
                  <form action={signOut}>
                    <button
                      type="submit"
                      className="rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    >
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/auth/login"
                    className="rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    Register
                  </Link>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 text-base font-semibold"
        >
          B2B Marketplace
        </Link>

        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="flex flex-1 items-center gap-2"
        >
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              className="h-9 pr-9"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon
                icon={Search01Icon}
                strokeWidth={2}
                className="size-4"
              />
            </button>
          </div>
          <Button
            type="submit"
            size="default"
            className="hidden sm:inline-flex"
          >
            Search
          </Button>
        </form>

        {/* Auth links */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link href={dashboardHref(user.user_type)}>
                <Button variant="ghost" size="sm">
                  Dashboard
                </Button>
              </Link>
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
