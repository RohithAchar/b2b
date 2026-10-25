"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  GridViewIcon,
  Home01Icon,
  Package01Icon,
  Search01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { isStorefrontTabActive } from "@/lib/nav"
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
    "relative flex min-w-0 flex-1 press touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
    active
      ? "text-brand-700 before:absolute before:top-0 before:left-1/2 before:h-0.5 before:w-5 before:-translate-x-1/2 before:rounded-sm before:bg-primary before:content-['']"
      : "text-muted-foreground hover:text-foreground"
  )
}

function ItemContent({
  icon,
  label,
  active,
}: {
  icon: IconSvgElement
  label: string
  active: boolean
}) {
  return (
    <>
      <HugeiconsIcon
        icon={icon}
        strokeWidth={active ? 2.4 : 2}
        className="size-5"
      />
      <span>{label}</span>
    </>
  )
}

/**
 * Search tab + bottom sheet. The shell persists across navigation, so the
 * parent remounts this component (keyed by route + query) and an open sheet
 * cannot stay over the results page. Search results cover both text (`q`) and
 * image (`img`) search.
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
        <ItemContent icon={Search01Icon} label="Search" active={active} />
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
  const hasSearch =
    Boolean(searchParams.get("q")) || Boolean(searchParams.get("img"))

  const homeActive = isStorefrontTabActive("home", pathname)
  const categoriesActive = isStorefrontTabActive("categories", pathname)
  const allProductsActive = isStorefrontTabActive(
    "products",
    pathname,
    hasSearch
  )
  const searchActive = isStorefrontTabActive("search", pathname, hasSearch)
  const accountActive = isStorefrontTabActive("account", pathname)

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 overflow-hidden bg-card pb-(--safe-area-bottom) before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border before:content-[''] lg:hidden">
      <nav
        aria-label="Storefront"
        className="mx-auto flex h-(--bottom-nav-height) max-w-7xl items-stretch"
      >
        <Link
          href="/"
          aria-current={homeActive ? "page" : undefined}
          className={itemClass(homeActive)}
        >
          <ItemContent icon={Home01Icon} label="Home" active={homeActive} />
        </Link>

        <Link
          href="/categories"
          aria-current={categoriesActive ? "page" : undefined}
          className={itemClass(categoriesActive)}
        >
          <ItemContent
            icon={GridViewIcon}
            label="Categories"
            active={categoriesActive}
          />
        </Link>

        <Link
          href="/products"
          aria-current={allProductsActive ? "page" : undefined}
          className={itemClass(allProductsActive)}
        >
          <ItemContent
            icon={Package01Icon}
            label="All Products"
            active={allProductsActive}
          />
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
                aria-current={accountActive ? "page" : undefined}
                className={itemClass(accountActive)}
              />
            }
          >
            <ItemContent
              icon={UserCircleIcon}
              label="Account"
              active={accountActive}
            />
          </AccountMenu>
        ) : (
          <Link
            href="/auth/login"
            aria-current={accountActive ? "page" : undefined}
            className={itemClass(accountActive)}
          >
            <ItemContent
              icon={UserCircleIcon}
              label="Account"
              active={accountActive}
            />
          </Link>
        )}
      </nav>
    </div>
  )
}
