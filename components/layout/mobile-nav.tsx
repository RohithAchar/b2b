"use client"

import { useState } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Menu01Icon } from "@hugeicons/core-free-icons"
import { navLinksFor, dashboardHref } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { signOut } from "@/lib/auth/actions"

type User = { email: string; user_type: string; isStaff?: boolean } | null
type NavCategory = { slug: string; name: string }

export function MobileNav({
  user,
  categories = [],
}: {
  user: User
  categories?: NavCategory[]
}) {
  const [open, setOpen] = useState(false)
  const navLinks = navLinksFor(user)
  // The header persists across client-side navigations, so every link
  // must close the Sheet explicitly.
  const close = () => setOpen(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-sm" className="size-10 lg:hidden" />}
      >
        <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetTitle className="flex items-center gap-2 border-b border-border px-4 py-4 text-base font-bold tracking-tight">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          B2B Marketplace
        </SheetTitle>
        <nav
          aria-label="Mobile"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3"
        >
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={close}
              className="rounded-md px-3 py-3 text-sm font-medium hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
          {categories.length > 0 ? (
            <>
              <Separator className="my-3" />
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Categories
              </p>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  onClick={close}
                  className="rounded-md px-3 py-3 text-sm text-muted-foreground hover:bg-muted"
                >
                  {cat.name}
                </Link>
              ))}
            </>
          ) : null}
          <div className="mt-4 border-t border-border pt-4">
            {user ? (
              <>
                <Link
                  href={dashboardHref(user.user_type, user.isStaff)}
                  onClick={close}
                  className="block rounded-md px-3 py-3 text-sm font-medium hover:bg-muted"
                >
                  Dashboard
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    onClick={close}
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
                  onClick={close}
                  className="block rounded-md px-3 py-3 text-sm font-medium hover:bg-muted"
                >
                  Sign in
                </Link>
                <Link
                  href="/supplier/onboarding"
                  onClick={close}
                  className="block rounded-md px-3 py-3 text-sm font-medium hover:bg-muted"
                >
                  Become a Supplier
                </Link>
              </>
            )}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
