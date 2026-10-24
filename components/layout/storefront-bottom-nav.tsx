"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  GridViewIcon,
  Home01Icon,
  Search01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { AccountMenu } from "@/components/layout/account-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { StorefrontSearchForm } from "@/components/storefront/storefront-search-form"

type User = { email: string; user_type: string; isStaff?: boolean } | null

function itemClass(active: boolean): string {
  return cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap press touch-manipulation",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
  )
}

function ItemContent({ icon, label }: { icon: IconSvgElement; label: string }) {
  return (
    <>
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-5" />
      <span>{label}</span>
    </>
  )
}

/**
 * Search tab + bottom sheet. The shell persists across navigation, so the
 * parent remounts this component (keyed by route + query) and an open sheet
 * cannot stay over the results page.
 */
function BottomSearchSheet({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-current={active ? "page" : undefined}
            className={itemClass(active)}
          />
        }
      >
        <ItemContent icon={Search01Icon} label="Search" />
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-(--safe-area-bottom)">
        <SheetHeader>
          <SheetTitle>Search products</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <StorefrontSearchForm autoFocus />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function StorefrontBottomNav({ user }: { user: User }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.get("q")

  const isProducts = pathname === "/products"
  const homeActive = pathname === "/"
  const categoriesActive =
    pathname === "/categories" || pathname.startsWith("/category")
  const searchActive = isProducts && Boolean(query)
  const accountActive =
    pathname.startsWith("/auth") || pathname.startsWith("/account")

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-border material pb-(--safe-area-bottom) lg:hidden">
      <nav
        aria-label="Storefront"
        className="mx-auto flex h-(--bottom-nav-height) max-w-7xl items-stretch"
      >
        <Link
          href="/"
          aria-current={homeActive ? "page" : undefined}
          className={itemClass(homeActive)}
        >
          <ItemContent icon={Home01Icon} label="Home" />
        </Link>

        <Link
          href="/categories"
          aria-current={categoriesActive ? "page" : undefined}
          className={itemClass(categoriesActive)}
        >
          <ItemContent icon={GridViewIcon} label="Categories" />
        </Link>

        <BottomSearchSheet
          key={`${pathname}?${searchParams.toString()}`}
          active={searchActive}
        />

        {user ? (
          <AccountMenu
            user={user}
            side="top"
            trigger={
              <button
                type="button"
                aria-label="Account"
                className={itemClass(accountActive)}
              />
            }
          >
            <ItemContent icon={UserCircleIcon} label="Account" />
          </AccountMenu>
        ) : (
          <Link
            href="/auth/login"
            aria-current={accountActive ? "page" : undefined}
            className={itemClass(accountActive)}
          >
            <ItemContent icon={UserCircleIcon} label="Account" />
          </Link>
        )}
      </nav>
    </div>
  )
}
