import { createClient } from "@/lib/supabase/server"
import { getAuthUser, getSessionUser } from "@/lib/auth/session"
import { getCartCount } from "@/lib/buyer/cart-actions"
import {
  getCachedMegaMenuCategories,
  getCachedNavigationCategories,
} from "@/lib/storefront-cache"
import { StorefrontShell } from "@/components/layout/storefront-shell"
import { StorefrontDataProvider } from "@/components/layout/storefront-data"

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  // Validate the session first, then resolve the profile, navigation and cart
  // badge together. Waiting for the profile before counting the cart used to
  // add a serial round trip to every storefront page.
  const authUser = await getAuthUser(supabase)
  const [sessionUser, navCategories, megaCategories, cartCount] = await Promise.all([
    getSessionUser(supabase),
    getCachedNavigationCategories(),
    getCachedMegaMenuCategories(),
    authUser ? getCartCount(supabase, authUser.id) : Promise.resolve(0),
  ])

  return (
    <StorefrontDataProvider categories={navCategories}>
      <StorefrontShell
        user={sessionUser}
        categories={navCategories}
        megaCategories={megaCategories}
        cartCount={cartCount}
      >
        {children}
      </StorefrontShell>
    </StorefrontDataProvider>
  )
}
