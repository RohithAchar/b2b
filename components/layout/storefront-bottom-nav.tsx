"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  GridViewIcon,
  Home01Icon,
  Message01Icon,
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

type User = { email: string; user_type: string } | null

function itemClass(active: boolean): string {
  return cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium whitespace-nowrap transition-colors",
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

export function StorefrontBottomNav({ user }: { user: User }) {
  const pathname = usePathname()
  const query = useSearchParams().get("q")
  const [searchOpen, setSearchOpen] = useState(false)

  const isProducts = pathname === "/products"
  const homeActive = pathname === "/"
  const categoriesActive =
    pathname.startsWith("/category") || (isProducts && !query)
  const searchActive = isProducts && Boolean(query)
  const accountActive = pathname.startsWith("/auth")

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden border-t border-border bg-card pb-(--safe-area-bottom) lg:hidden">
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
          href="/products"
          aria-current={categoriesActive ? "page" : undefined}
          className={itemClass(categoriesActive)}
        >
          <ItemContent icon={GridViewIcon} label="Categories" />
        </Link>

        <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-current={searchActive ? "page" : undefined}
                className={itemClass(searchActive)}
              />
            }
          >
            <ItemContent icon={Search01Icon} label="Search" />
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Search products</SheetTitle>
            </SheetHeader>
            <div className="px-6 pb-6">
              <StorefrontSearchForm autoFocus />
            </div>
          </SheetContent>
        </Sheet>

        <button
          type="button"
          aria-disabled="true"
          aria-label="Enquiries (coming soon)"
          title="Coming soon"
          className={cn(itemClass(false), "cursor-default")}
        >
          <ItemContent icon={Message01Icon} label="Enquiries" />
        </button>

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
