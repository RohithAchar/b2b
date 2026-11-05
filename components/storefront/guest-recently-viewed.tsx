"use client"

import { useRecentlyViewed } from "@/hooks/use-recently-viewed"
import { RecentlyViewedBlock } from "@/components/storefront/recently-viewed-rail"

/** Guest recently viewed rail, hydrated from localStorage. */
export function GuestRecentlyViewed() {
  const items = useRecentlyViewed()
  if (items.length === 0) return null
  return <RecentlyViewedBlock items={items} />
}
