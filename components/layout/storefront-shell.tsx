import type { ReactNode } from "react"
import { StorefrontHeader } from "@/components/layout/storefront-header"
import { StorefrontFooter } from "@/components/layout/storefront-footer"
import { StorefrontBottomNav } from "@/components/layout/storefront-bottom-nav"

type User = { email: string; user_type: string } | null
type NavCategory = { slug: string; name: string }

export function StorefrontShell({
  user,
  categories,
  children,
}: {
  user: User
  categories?: NavCategory[]
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col pb-(--bottom-nav-offset) lg:pb-0">
      <StorefrontHeader user={user} categories={categories} />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      <StorefrontBottomNav user={user} />
    </div>
  )
}
