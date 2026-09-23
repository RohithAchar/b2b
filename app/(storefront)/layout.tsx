import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
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

  return (
    <StorefrontDataProvider categories={navCategories}>
      <StorefrontShell user={sessionUser} categories={navCategories}>
        {children}
      </StorefrontShell>
    </StorefrontDataProvider>
  )
}
