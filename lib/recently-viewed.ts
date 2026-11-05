/**
 * Guest recently-viewed products, persisted in `localStorage`.
 *
 * Signed-in buyers have a server-side history (`recently_viewed` table). This
 * store covers signed-out visitors with a compact snapshot so the homepage can
 * show real products they opened without inventing recommendations. Only the
 * display fields are stored; prices are deliberately omitted so a snapshot can
 * never show a stale price.
 */

export const RECENTLY_VIEWED_STORAGE_KEY = "b2b:recently-viewed"
export const RECENTLY_VIEWED_LIMIT = 12

export type RecentlyViewedSnapshot = {
  id: string
  title: string
  image: string | null
}

const EMPTY_RECENTLY_VIEWED: RecentlyViewedSnapshot[] = []
const listeners = new Set<() => void>()
let cached: RecentlyViewedSnapshot[] | null = null

function normalizeSnapshot(value: unknown): RecentlyViewedSnapshot | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  const title = typeof record.title === "string" ? record.title.trim() : ""
  if (!id || !title) return null
  return {
    id,
    title,
    image: typeof record.image === "string" && record.image ? record.image : null,
  }
}

function readStoredRecentlyViewed(): RecentlyViewedSnapshot[] {
  if (typeof window === "undefined") return EMPTY_RECENTLY_VIEWED
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY)
    if (!raw) return EMPTY_RECENTLY_VIEWED
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return EMPTY_RECENTLY_VIEWED

    const seen = new Set<string>()
    const items: RecentlyViewedSnapshot[] = []
    for (const entry of parsed) {
      const snapshot = normalizeSnapshot(entry)
      if (!snapshot || seen.has(snapshot.id)) continue
      seen.add(snapshot.id)
      items.push(snapshot)
      if (items.length === RECENTLY_VIEWED_LIMIT) break
    }
    return items
  } catch {
    return EMPTY_RECENTLY_VIEWED
  }
}

function writeStoredRecentlyViewed(items: RecentlyViewedSnapshot[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      RECENTLY_VIEWED_STORAGE_KEY,
      JSON.stringify(items)
    )
  } catch {
    // Storage may be unavailable (private mode); keep the in-memory list.
  }
}

function updateSnapshot(items: RecentlyViewedSnapshot[]): void {
  cached = items
  listeners.forEach((listener) => listener())
}

function notifyFromStorage(): void {
  updateSnapshot(readStoredRecentlyViewed())
}

export function getRecentlyViewedSnapshot(): RecentlyViewedSnapshot[] {
  if (cached === null) cached = readStoredRecentlyViewed()
  return cached
}

/** Server snapshot is deliberately empty to avoid hydration mismatches. */
export function getRecentlyViewedServerSnapshot(): RecentlyViewedSnapshot[] {
  return EMPTY_RECENTLY_VIEWED
}

export function subscribeRecentlyViewed(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== RECENTLY_VIEWED_STORAGE_KEY && event.key !== null) return
    notifyFromStorage()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** Record a product as the newest viewed item and return the updated list. */
export function addRecentlyViewed(
  item: RecentlyViewedSnapshot
): RecentlyViewedSnapshot[] {
  const snapshot = normalizeSnapshot(item)
  if (!snapshot) return getRecentlyViewedSnapshot()

  const current = getRecentlyViewedSnapshot()
  const next = [
    snapshot,
    ...current.filter((existing) => existing.id !== snapshot.id),
  ].slice(0, RECENTLY_VIEWED_LIMIT)

  writeStoredRecentlyViewed(next)
  updateSnapshot(next)
  return next
}

export function clearRecentlyViewed(): void {
  writeStoredRecentlyViewed([])
  updateSnapshot([])
}
