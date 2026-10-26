"use client"

import { useSyncExternalStore } from "react"
import {
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  subscribeRecentSearches,
} from "@/lib/recent-searches"

export function useRecentSearches(): string[] {
  return useSyncExternalStore(
    subscribeRecentSearches,
    getRecentSearchesSnapshot,
    getRecentSearchesServerSnapshot
  )
}
