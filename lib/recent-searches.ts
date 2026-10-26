/**
 * Recent storefront search terms, persisted in `localStorage`.
 *
 * Search state is shared by the desktop mega-menu, the homepage hero, and the
 * mobile bottom sheet. A module-level snapshot plus `useSyncExternalStore`
 * keeps every mounted search surface in sync after a term is recorded or the
 * history is cleared.
 */

import { normalizeSuggestQuery } from "@/lib/search-suggest"

export const RECENT_SEARCHES_STORAGE_KEY = "b2b:recent-searches"
export const RECENT_SEARCHES_LIMIT = 6

const EMPTY_RECENT_SEARCHES: string[] = []
const listeners = new Set<() => void>()
let cached: string[] | null = null

function readStoredSearches(): string[] {
  if (typeof window === "undefined") return EMPTY_RECENT_SEARCHES
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY)
    if (!raw) return EMPTY_RECENT_SEARCHES
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_RECENT_SEARCHES
    const seen = new Set<string>()
    return parsed
      .filter((term): term is string => typeof term === "string")
      .map(normalizeSuggestQuery)
      .filter((term) => {
        if (!term) return false
        const key = term.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, RECENT_SEARCHES_LIMIT)
  } catch {
    return EMPTY_RECENT_SEARCHES
  }
}

function writeStoredSearches(searches: string[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_STORAGE_KEY,
      JSON.stringify(searches)
    )
  } catch {
    // Storage may be unavailable (private mode); keep the in-memory list.
  }
}

function updateSnapshot(searches: string[]): void {
  cached = searches
  listeners.forEach((listener) => listener())
}

function notifyFromStorage(): void {
  updateSnapshot(readStoredSearches())
}

/** Snapshot for `useSyncExternalStore`; stable until the history changes. */
export function getRecentSearchesSnapshot(): string[] {
  if (cached === null) cached = readStoredSearches()
  return cached
}

/** Server snapshot is deliberately empty to avoid hydration mismatches. */
export function getRecentSearchesServerSnapshot(): string[] {
  return EMPTY_RECENT_SEARCHES
}

export function subscribeRecentSearches(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== RECENT_SEARCHES_STORAGE_KEY && event.key !== null) return
    notifyFromStorage()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** Record a term as the newest recent search and return the updated list. */
export function addRecentSearch(term: string): string[] {
  const normalized = normalizeSuggestQuery(term)
  if (!normalized) return getRecentSearchesSnapshot()

  const current = getRecentSearchesSnapshot()
  const next = [
    normalized,
    ...current.filter(
      (existing) => existing.toLowerCase() !== normalized.toLowerCase()
    ),
  ].slice(0, RECENT_SEARCHES_LIMIT)

  writeStoredSearches(next)
  updateSnapshot(next)
  return next
}

export function clearRecentSearches(): void {
  writeStoredSearches([])
  updateSnapshot([])
}
