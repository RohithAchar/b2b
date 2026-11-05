import { beforeEach, describe, expect, it, vi } from "vitest"

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  clear(): void {
    this.values.clear()
  }
}

function installWindow() {
  const storage = new MemoryStorage()
  vi.stubGlobal("window", {
    localStorage: storage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  return storage
}

async function loadStore() {
  return import("../lib/recently-viewed")
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe("recently viewed", () => {
  it("stores the newest product first", async () => {
    const storage = installWindow()
    const { addRecentlyViewed, getRecentlyViewedSnapshot } = await loadStore()

    addRecentlyViewed({ id: "a", title: "Cotton fabric", image: null })
    addRecentlyViewed({
      id: "b",
      title: "LED lights",
      image: "https://example.com/b.jpg",
    })

    expect(getRecentlyViewedSnapshot()).toEqual([
      {
        id: "b",
        title: "LED lights",
        image: "https://example.com/b.jpg",
      },
      { id: "a", title: "Cotton fabric", image: null },
    ])
    expect(
      JSON.parse(storage.getItem("b2b:recently-viewed") ?? "[]")
    ).toHaveLength(2)
  })

  it("deduplicates by product id and moves the item to the front", async () => {
    installWindow()
    const { addRecentlyViewed, getRecentlyViewedSnapshot } = await loadStore()

    addRecentlyViewed({ id: "a", title: "Cotton fabric", image: null })
    addRecentlyViewed({ id: "b", title: "Steel plates", image: null })
    addRecentlyViewed({ id: "a", title: "Cotton fabric", image: null })

    expect(getRecentlyViewedSnapshot().map((item) => item.id)).toEqual([
      "a",
      "b",
    ])
  })

  it("caps the history at the configured limit", async () => {
    installWindow()
    const {
      addRecentlyViewed,
      getRecentlyViewedSnapshot,
      RECENTLY_VIEWED_LIMIT,
    } = await loadStore()

    for (let i = 0; i < RECENTLY_VIEWED_LIMIT + 2; i += 1) {
      addRecentlyViewed({ id: `p${i}`, title: `Product ${i}`, image: null })
    }

    const items = getRecentlyViewedSnapshot()
    expect(items).toHaveLength(RECENTLY_VIEWED_LIMIT)
    expect(items[0]?.id).toBe(`p${RECENTLY_VIEWED_LIMIT + 1}`)
  })

  it("ignores invalid entries and clears the list", async () => {
    const storage = installWindow()
    const {
      addRecentlyViewed,
      clearRecentlyViewed,
      getRecentlyViewedSnapshot,
    } = await loadStore()

    addRecentlyViewed({ id: "", title: "Missing id", image: null })
    addRecentlyViewed({ id: "a", title: "   ", image: null })
    expect(getRecentlyViewedSnapshot()).toEqual([])

    addRecentlyViewed({ id: "a", title: "Jute bags", image: null })
    clearRecentlyViewed()

    expect(getRecentlyViewedSnapshot()).toEqual([])
    expect(storage.getItem("b2b:recently-viewed")).toBe("[]")
  })

  it("reads and normalizes an existing history from storage", async () => {
    const storage = installWindow()
    storage.setItem(
      "b2b:recently-viewed",
      JSON.stringify([
        { id: "a", title: " Cotton ", image: "" },
        42,
        { id: "a", title: "Duplicate", image: null },
        { id: "b", title: "Steel", image: "https://example.com/b.jpg" },
      ])
    )

    const { getRecentlyViewedSnapshot } = await loadStore()
    expect(getRecentlyViewedSnapshot()).toEqual([
      { id: "a", title: "Cotton", image: null },
      { id: "b", title: "Steel", image: "https://example.com/b.jpg" },
    ])
  })
})
