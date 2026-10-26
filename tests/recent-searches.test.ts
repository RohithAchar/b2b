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
  return import("../lib/recent-searches")
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe("recent searches", () => {
  it("stores the newest term first and trims it", async () => {
    const storage = installWindow()
    const { addRecentSearch, getRecentSearchesSnapshot } = await loadStore()

    addRecentSearch("  cotton fabric  ")
    addRecentSearch("led lights")

    expect(getRecentSearchesSnapshot()).toEqual(["led lights", "cotton fabric"])
    expect(JSON.parse(storage.getItem("b2b:recent-searches") ?? "[]")).toEqual([
      "led lights",
      "cotton fabric",
    ])
  })

  it("deduplicates case-insensitively and moves the term to the front", async () => {
    installWindow()
    const { addRecentSearch, getRecentSearchesSnapshot } = await loadStore()

    addRecentSearch("Cotton")
    addRecentSearch("steel")
    addRecentSearch("cotton")

    expect(getRecentSearchesSnapshot()).toEqual(["cotton", "steel"])
  })

  it("caps the history at the configured limit", async () => {
    installWindow()
    const {
      addRecentSearch,
      getRecentSearchesSnapshot,
      RECENT_SEARCHES_LIMIT,
    } = await loadStore()

    for (let i = 0; i < RECENT_SEARCHES_LIMIT + 2; i += 1) {
      addRecentSearch(`term ${i}`)
    }

    const recent = getRecentSearchesSnapshot()
    expect(recent).toHaveLength(RECENT_SEARCHES_LIMIT)
    expect(recent[0]).toBe(`term ${RECENT_SEARCHES_LIMIT + 1}`)
  })

  it("ignores empty terms and clears the history", async () => {
    const storage = installWindow()
    const { addRecentSearch, clearRecentSearches, getRecentSearchesSnapshot } =
      await loadStore()

    addRecentSearch("   ")
    expect(getRecentSearchesSnapshot()).toEqual([])

    addRecentSearch("jute bags")
    clearRecentSearches()

    expect(getRecentSearchesSnapshot()).toEqual([])
    expect(storage.getItem("b2b:recent-searches")).toBe("[]")
  })

  it("reads an existing history from storage", async () => {
    const storage = installWindow()
    storage.setItem(
      "b2b:recent-searches",
      JSON.stringify([" spices ", 42, "", "spices"])
    )

    const { getRecentSearchesSnapshot } = await loadStore()
    expect(getRecentSearchesSnapshot()).toEqual(["spices"])
  })
})
