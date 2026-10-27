"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { decodeCatalogueCursor } from "@/lib/catalogue"
import { getCataloguePage, type CataloguePage } from "@/lib/storefront"

const filtersSchema = z.object({
  query: z.string().max(200).default(""),
  categorySlug: z.string().max(120).default(""),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc", "moq_asc"]),
  minPrice: z.number().finite().nonnegative().optional(),
  maxPrice: z.number().finite().nonnegative().optional(),
  minMoq: z.number().int().nonnegative().optional(),
  maxMoq: z.number().int().nonnegative().optional(),
  inStock: z.boolean().optional(),
  negotiable: z.boolean().optional(),
  sampleAvailable: z.boolean().optional(),
  imageToken: z.string().max(4096).optional(),
})

export type CatalogueLoadResult =
  | { ok: true; page: CataloguePage }
  | { ok: false; message: string }

export async function loadCataloguePage(
  input: unknown,
  cursorToken: string | null,
): Promise<CatalogueLoadResult> {
  const parsed = filtersSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Those filters are not valid." }
  }

  const cursor = cursorToken ? decodeCatalogueCursor(cursorToken) : null
  if (cursorToken && !cursor) {
    return { ok: false, message: "This page link is invalid. Refresh and try again." }
  }

  try {
    const supabase = await createClient()
    const page = await getCataloguePage(supabase, parsed.data, cursor)
    return { ok: true, page }
  } catch (error) {
    console.error("[catalogue] load more failed:", error)
    return {
      ok: false,
      message: "Could not load more products. Check your connection and try again.",
    }
  }
}
