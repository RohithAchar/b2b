import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getCartCount } from "@/lib/buyer/cart-actions"
import { getNavigationCategories } from "@/lib/storefront"
import { StorefrontShell } from "@/components/layout/storefront-shell"
import { StorefrontDataProvider } from "@/components/layout/storefront-data"

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const [sessionUser, navCategories] = await Promise.all([
    getSessionUser(supabase),
    getNavigationCategories(supabase),
  ])
  const cartCount = sessionUser ? await getCartCount(supabase, sessionUser.id) : 0

  return (
    <StorefrontDataProvider categories={navCategories}>
      <StorefrontShell user={sessionUser} categories={navCategories} cartCount={cartCount}>
        {children}
      </StorefrontShell>
    </StorefrontDataProvider>
  )
}
