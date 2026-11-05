"use client"

import { useEffect } from "react"
import { addRecentlyViewed } from "@/lib/recently-viewed"

/**
 * Records a signed-out visitor's product view in localStorage. Signed-in
 * buyers are recorded server-side by `recordRecentlyViewed`, so this renders
 * only for guests.
 */
export function GuestRecentlyViewedTracker({
  productId,
  title,
  image,
}: {
  productId: string
  title: string
  image: string | null
}) {
  useEffect(() => {
    addRecentlyViewed({ id: productId, title, image })
  }, [productId, title, image])

  return null
}
