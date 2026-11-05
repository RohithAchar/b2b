import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getBuyerRecentlyViewed } from "@/lib/buyer/queries"
import { publicTransformedImageUrl } from "@/lib/storage"
import { RECENTLY_VIEWED_LIMIT } from "@/lib/recently-viewed"
import { GuestRecentlyViewed } from "@/components/storefront/guest-recently-viewed"
import {
  RecentlyViewedBlock,
  type RecentRailItem,
} from "@/components/storefront/recently-viewed-rail"

/**
 * Signed-in buyers get their real server-side history. Guests read the
 * localStorage snapshots written by the product page, so the section never
 * renders invented products.
 */
export async function RecentlyViewedSection() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) return <GuestRecentlyViewed />

  const { products } = await getBuyerRecentlyViewed(
    supabase,
    user.id,
    1,
    RECENTLY_VIEWED_LIMIT
  )
  if (products.length === 0) return null

  const items: RecentRailItem[] = products.map((product) => {
    const cover = [...(product.images ?? [])].sort((a, b) => a.sort - b.sort)[0]
    return {
      id: product.id,
      title: product.title,
      image: cover
        ? publicTransformedImageUrl("product_images", cover.path, {
            width: 320,
          })
        : null,
    }
  })

  return <RecentlyViewedBlock items={items} showViewAll />
}
