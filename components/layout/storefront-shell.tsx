import type { ReactNode } from "react"
import { StorefrontHeader } from "@/components/layout/storefront-header"
import { StorefrontFooter } from "@/components/layout/storefront-footer"
import { StorefrontBottomNav } from "@/components/layout/storefront-bottom-nav"
import { StorefrontMiniSearch } from "@/components/storefront/storefront-mini-search"

type User = { email: string; user_type: string } | null
type NavCategory = { slug: string; name: string }

export function StorefrontShell({
  user,
  categories,
  cartCount = 0,
  children,
}: {
  user: User
  categories?: NavCategory[]
  cartCount?: number
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col pb-(--bottom-nav-offset) lg:pb-0">
      <StorefrontHeader user={user} categories={categories} cartCount={cartCount} />
      <StorefrontMiniSearch />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      <StorefrontBottomNav user={user} />
    </div>
  )
}
