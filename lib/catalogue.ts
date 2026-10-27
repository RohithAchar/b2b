import { decodeImageResultToken } from "@/lib/ai/image-result-token"

export const CATALOGUE_PAGE_SIZE = 24

export const CATALOGUE_SORTS = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "moq_asc",
] as const

export type CatalogueSort = (typeof CATALOGUE_SORTS)[number]

export type CatalogueFilters = {
  query: string
  categorySlug: string
  sort: CatalogueSort
  minPrice?: number
  maxPrice?: number
  minMoq?: number
  maxMoq?: number
  inStock?: boolean
  negotiable?: boolean
  sampleAvailable?: boolean
  imageToken?: string
}

export type CatalogueSearchParams = Record<
  string,
  string | string[] | undefined
>

export type CatalogueCursor = {
  value: number
  id: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseCatalogueNumber(
  value: string | undefined,
): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function parseCatalogueInteger(
  value: string | undefined,
): number | undefined {
  const n = parseCatalogueNumber(value)
  return n == null ? undefined : Math.floor(n)
}

export function parseCatalogueSort(
  value: string | undefined,
  hasImageSearch = false,
): CatalogueSort {
  if (
    value &&
    CATALOGUE_SORTS.includes(value as CatalogueSort) &&
    (value !== "relevance" || hasImageSearch)
  ) {
    return value as CatalogueSort
  }
  return hasImageSearch ? "relevance" : "newest"
}

export function parseCatalogueFilters(
  searchParams: CatalogueSearchParams,
): CatalogueFilters {
  const query = (first(searchParams.q) ?? "").trim().slice(0, 200)
  const categorySlug = (first(searchParams.category) ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 120)
  const imageToken = first(searchParams.img)
  const imageIds = decodeImageResultToken(imageToken)
  const sort = parseCatalogueSort(first(searchParams.sort), !!imageIds)

  return {
    query,
    categorySlug,
    sort,
    minPrice: parseCatalogueNumber(first(searchParams.minPrice)),
    maxPrice: parseCatalogueNumber(first(searchParams.maxPrice)),
    minMoq: parseCatalogueInteger(first(searchParams.minMoq)),
    maxMoq: parseCatalogueInteger(first(searchParams.maxMoq)),
    inStock: first(searchParams.inStock) === "true",
    negotiable: first(searchParams.negotiable) === "true",
    sampleAvailable: first(searchParams.sampleAvailable) === "true",
    imageToken: imageIds ? imageToken : undefined,
  }
}

function isDefaultSort(filters: CatalogueFilters) {
  if (filters.imageToken) return filters.sort === "relevance"
  return filters.sort === "newest"
}

export function buildCatalogueUrl(
  basePath: string,
  filters: CatalogueFilters,
  overrides: Partial<CatalogueFilters> = {},
): string {
  const next: CatalogueFilters = { ...filters, ...overrides }
  const sp = new URLSearchParams()

  if (next.query) sp.set("q", next.query)
  if (next.categorySlug) sp.set("category", next.categorySlug)
  if (!isDefaultSort(next)) sp.set("sort", next.sort)
  if (next.minPrice != null) sp.set("minPrice", String(next.minPrice))
  if (next.maxPrice != null) sp.set("maxPrice", String(next.maxPrice))
  if (next.minMoq != null) sp.set("minMoq", String(next.minMoq))
  if (next.maxMoq != null) sp.set("maxMoq", String(next.maxMoq))
  if (next.inStock) sp.set("inStock", "true")
  if (next.negotiable) sp.set("negotiable", "true")
  if (next.sampleAvailable) sp.set("sampleAvailable", "true")
  if (next.imageToken) sp.set("img", next.imageToken)

  const qs = sp.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function catalogueFiltersKey(filters: CatalogueFilters): string {
  return JSON.stringify({
    query: filters.query,
    categorySlug: filters.categorySlug,
    sort: filters.sort,
    minPrice: filters.minPrice ?? null,
    maxPrice: filters.maxPrice ?? null,
    minMoq: filters.minMoq ?? null,
    maxMoq: filters.maxMoq ?? null,
    inStock: !!filters.inStock,
    negotiable: !!filters.negotiable,
    sampleAvailable: !!filters.sampleAvailable,
    imageToken: filters.imageToken ?? null,
  })
}

export function countCatalogueFilters(filters: CatalogueFilters): number {
  return [
    !!filters.categorySlug,
    filters.minPrice != null,
    filters.maxPrice != null,
    filters.minMoq != null,
    filters.maxMoq != null,
    filters.inStock,
    filters.negotiable,
    filters.sampleAvailable,
  ].filter(Boolean).length
}

export function encodeCatalogueCursor(cursor: CatalogueCursor): string {
  const json = JSON.stringify(cursor)
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeCatalogueCursor(
  token: string | null | undefined,
): CatalogueCursor | null {
  if (!token) return null

  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/")
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    )
    const parsed = JSON.parse(atob(padded)) as unknown
    if (!parsed || typeof parsed !== "object") return null

    const value = (parsed as { value?: unknown }).value
    const id = (parsed as { id?: unknown }).id
    if (typeof value !== "number" || !Number.isFinite(value)) return null
    if (typeof id !== "string" || !UUID_RE.test(id)) return null

    return { value, id }
  } catch {
    return null
  }
}
