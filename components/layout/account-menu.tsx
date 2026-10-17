"use client"

import type { ReactElement, ReactNode } from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building02Icon,
  Clock01Icon,
  DashboardSquare01Icon,
  HeartIcon,
  Location01Icon,
  Logout01Icon,
  Package01Icon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/lib/auth/actions"

type AccountUser = { email: string; user_type: string; isStaff?: boolean }

function initials(value: string): string {
  const name = value.includes("@") ? value.split("@")[0] : value
  const parts = name
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
  if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function roleLabel(user: AccountUser): string {
  const label =
    user.user_type === "admin"
      ? "Admin"
      : user.user_type === "supplier"
        ? "Supplier"
        : "Buyer"
  return `${label} account${user.isStaff ? " · Staff" : ""}`
}

const ROLE_LINKS: Record<
  string,
  { label: string; href: string; icon: ReactNode }[]
> = {
  buyer: [
    {
      label: "My Orders",
      href: "/orders",
      icon: <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />,
    },
    {
      label: "Saved Products",
      href: "/account?tab=saved",
      icon: <HugeiconsIcon icon={HeartIcon} strokeWidth={2} />,
    },
    {
      label: "Recently Viewed",
      href: "/account?tab=recent",
      icon: <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />,
    },
    {
      label: "Delivery Addresses",
      href: "/account?tab=addresses",
      icon: <HugeiconsIcon icon={Location01Icon} strokeWidth={2} />,
    },
  ],
  supplier: [
    {
      label: "Dashboard",
      href: "/supplier/dashboard",
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
    {
      label: "Business profile",
      href: "/supplier/dashboard/business",
      icon: <HugeiconsIcon icon={Building02Icon} strokeWidth={2} />,
    },
    {
      label: "Products",
      href: "/supplier/dashboard/products",
      icon: <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />,
    },
    {
      label: "Verification",
      href: "/supplier/dashboard/verification",
      icon: <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} />,
    },
  ],
  admin: [
    {
      label: "Admin dashboard",
      href: "/admin/dashboard",
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
    },
  ],
}

// Staff keep their own account type but gain supplier-dashboard access.
// Owner-only entries (Business profile, Verification) are withheld from
// staff — those pages redirect them out, so linking them would be a dead end.
const OWNER_ONLY_HREFS = new Set([
  "/supplier/dashboard/business",
  "/supplier/dashboard/verification",
])

const STAFF_LINKS: { label: string; href: string; icon: ReactNode }[] = [
  {
    label: "Supplier dashboard",
    href: "/supplier/dashboard",
    icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
  },
  {
    label: "Products",
    href: "/supplier/dashboard/products",
    icon: <HugeiconsIcon icon={Package01Icon} strokeWidth={2} />,
  },
]

function linksFor(user: AccountUser): { label: string; href: string; icon: ReactNode }[] {
  const base = ROLE_LINKS[user?.user_type || ""] ?? []
  if (!user?.isStaff) return base
  const reachable = base.filter((link) => !OWNER_ONLY_HREFS.has(link.href))
  if (reachable.some((link) => link.href === "/supplier/dashboard")) {
    return reachable
  }
  return [...STAFF_LINKS, ...reachable]
}

export function AccountMenu({
  user,
  trigger,
  children,
  side = "bottom",
}: {
  user: AccountUser
  trigger?: ReactElement
  children?: ReactNode
  side?: "top" | "bottom"
}) {
  const fallback = user?.email ? initials(user.email) : "U"
  const links = linksFor(user)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          trigger ?? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Account"
              className="cursor-pointer"
            />
          )
        }
      >
        {children ?? (
          <Avatar>
            <AvatarFallback>{fallback}</AvatarFallback>
          </Avatar>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side={side}
        sideOffset={4}
        className="min-w-56 rounded-lg"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="size-8">
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.email}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel(user)}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {links.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {links.map((link) => (
                <DropdownMenuItem
                  key={link.href}
                  render={<Link href={link.href} />}
                >
                  {link.icon}
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
