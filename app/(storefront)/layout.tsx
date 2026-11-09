import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server"
import { getAuthUser, getSessionUser } from "@/lib/auth/session"
import { getCartCount } from "@/lib/buyer/cart-actions"
import {
  getCachedMegaMenuCategories,
  getCachedNavigationCategories,
} from "@/lib/storefront-cache"
import { resolveStore, getActiveStores, type ActiveStore } from "@/lib/store-context"
import { StorefrontShell } from "@/components/layout/storefront-shell"
import { StorefrontDataProvider } from "@/components/layout/storefront-data"

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const storeId = cookieStore.get("d2b_store")?.value ?? null
  // Resolve the active store from the cookie; fall back to the first active
  // store when none is selected. Client-supplied IDs are validated — an
  // inactive or unknown store is never used.
  const authUser = await getAuthUser(supabase)
  const [
    sessionUser,
    navCategories,
    megaCategories,
    cartCount,
    activeStore,
    activeStores,
  ] = await Promise.all([
    getSessionUser(supabase),
    getCachedNavigationCategories(),
    getCachedMegaMenuCategories(),
    authUser ? getCartCount(supabase, authUser.id) : Promise.resolve(0),
    resolveStore(supabase, storeId),
    getActiveStores(),
  ])

  return (
    <StorefrontDataProvider categories={navCategories}>
      <StorefrontShell
        user={sessionUser}
        categories={navCategories}
        megaCategories={megaCategories}
        cartCount={cartCount}
        activeStore={activeStore}
        activeStores={activeStores}
      >
        {children}
      </StorefrontShell>
    </StorefrontDataProvider>
  )
}
