"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  GridViewIcon,
  Home01Icon,
  Logout01Icon,
  Menu01Icon,
  Package01Icon,
  ReceiptTextIcon,
  ShoppingCart01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "cn"
import { dashboardHref, isStorefrontTabActive } from "@/lib/nav"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { signOut } from "@/lib/auth/actions"

type User = { email: string; user_type: string; isStaff?: boolean } | null
type NavCategory = { slug: string; name: string }

function rowClass(active: boolean, quiet = false): string {
  return cn(
    "relative flex min-h-10 press touch-manipulation items-center gap-3 rounded-md px-3 text-sm",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
    active
      ? "bg-primary/5 font-medium text-brand-700 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-sm before:bg-primary before:content-['']"
      : quiet
        ? "text-muted-foreground hover:bg-muted hover:text-foreground"
        : "text-foreground/85 hover:bg-muted hover:text-foreground"
  )
}

function DrawerLink({
  href,
  label,
  icon,
  active,
  quiet,
  onClick,
}: {
  href: string
  label: string
  icon?: IconSvgElement
  active?: boolean
  quiet?: boolean
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={rowClass(Boolean(active), quiet)}
      title={label}
    >
      {icon ? (
        <HugeiconsIcon
          icon={icon}
          strokeWidth={2}
          className="size-5 shrink-0"
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  )
}

function DrawerSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function MobileNav({
  user,
  categories = [],
}: {
  user: User
  categories?: NavCategory[]
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hasSearch =
    Boolean(searchParams.get("q")) || Boolean(searchParams.get("img"))
  // The header persists across client-side navigations, so every link
  // must close the Sheet explicitly.
  const close = () => setOpen(false)
  const isWorkspaceUser = Boolean(
    user &&
    (user.isStaff ||
      user.user_type === "supplier" ||
      user.user_type === "admin")
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-10 lg:hidden"
          />
        }
      >
        <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="max-w-sm border-r border-border bg-popover p-0"
      >
        <SheetTitle className="flex items-center gap-3 border-b border-border px-4 py-4 pr-14 text-base font-bold tracking-tight">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">B2B Marketplace</span>
            <span className="truncate text-[11px] font-medium tracking-wide text-muted-foreground">
              Wholesale sourcing
            </span>
          </span>
        </SheetTitle>

        <nav
          aria-label="Mobile"
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4"
        >
          <DrawerSection title="Marketplace">
            <DrawerLink
              href="/"
              label="Home"
              icon={Home01Icon}
              active={isStorefrontTabActive("home", pathname)}
              onClick={close}
            />
            <DrawerLink
              href="/categories"
              label="Categories"
              icon={GridViewIcon}
              active={isStorefrontTabActive("categories", pathname)}
              onClick={close}
            />
            <DrawerLink
              href="/products"
              label="All Products"
              icon={Package01Icon}
              active={isStorefrontTabActive("products", pathname, hasSearch)}
              onClick={close}
            />
          </DrawerSection>

          {user ? (
            <DrawerSection title="Business">
              <DrawerLink
                href="/orders"
                label="Orders"
                icon={ReceiptTextIcon}
                active={pathname.startsWith("/orders")}
                onClick={close}
              />
              <DrawerLink
                href="/cart"
                label="Cart"
                icon={ShoppingCart01Icon}
                active={pathname === "/cart"}
                onClick={close}
              />
            </DrawerSection>
          ) : null}

          {categories.length > 0 ? (
            <DrawerSection title="Popular Categories">
              {categories.map((category) => (
                <DrawerLink
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  label={category.name}
                  active={pathname === `/category/${category.slug}`}
                  quiet
                  onClick={close}
                />
              ))}
            </DrawerSection>
          ) : null}
        </nav>

        <div className="border-t border-border px-3 py-3">
          {user ? (
            <>
              {isWorkspaceUser ? (
                <DrawerLink
                  href={dashboardHref(user.user_type, user.isStaff)}
                  label="Dashboard"
                  icon={DashboardSquare01Icon}
                  onClick={close}
                />
              ) : (
                <DrawerLink
                  href="/account"
                  label="My account"
                  icon={UserCircleIcon}
                  active={pathname.startsWith("/account")}
                  onClick={close}
                />
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  onClick={close}
                  className="flex min-h-10 w-full press touch-manipulation items-center gap-3 rounded-md px-3 text-left text-sm text-destructive hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                >
                  <HugeiconsIcon
                    icon={Logout01Icon}
                    strokeWidth={2}
                    className="size-5 shrink-0"
                  />
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <DrawerLink
                href="/auth/login"
                label="Sign in"
                icon={UserCircleIcon}
                active={pathname.startsWith("/auth")}
                onClick={close}
              />
              <DrawerLink
                href="/supplier/onboarding"
                label="Become a Supplier"
                onClick={close}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
