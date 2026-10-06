import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getCartCount } from "@/lib/buyer/cart-actions"
import { getCachedNavigationCategories } from "@/lib/storefront-cache"
import { StorefrontShell } from "@/components/layout/storefront-shell"
import { StorefrontDataProvider } from "@/components/layout/storefront-data"

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const [sessionUser, navCategories] = await Promise.all([
    getSessionUser(supabase),
    getCachedNavigationCategories(),
  ])
  const cartCountPromise = sessionUser ? getCartCount(supabase, sessionUser.id) : Promise.resolve(0)
  const [cartCount] = await Promise.all([cartCountPromise])

  return (
    <StorefrontDataProvider categories={navCategories}>
      <StorefrontShell user={sessionUser} categories={navCategories} cartCount={cartCount}>
        {children}
      </StorefrontShell>
    </StorefrontDataProvider>
  )
}
