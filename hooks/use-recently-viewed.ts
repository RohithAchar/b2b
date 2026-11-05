"use client"

import { useSyncExternalStore } from "react"
import {
  getRecentlyViewedServerSnapshot,
  getRecentlyViewedSnapshot,
  subscribeRecentlyViewed,
} from "@/lib/recently-viewed"

export function useRecentlyViewed() {
  return useSyncExternalStore(
    subscribeRecentlyViewed,
    getRecentlyViewedSnapshot,
    getRecentlyViewedServerSnapshot
  )
}
