"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { NAV_LINKS, dashboardHref } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOut } from "@/lib/auth/actions";

type User = { email: string; user_type: string } | null;
type NavCategory = { slug: string; name: string };

export function MobileNav({
  user,
  categories = [],
}: {
  user: User;
  categories?: NavCategory[];
}) {
  return (
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
  );
}