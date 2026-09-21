import { Suspense } from "react"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getProduct, getNavigationCategories } from "@/lib/storefront"
import { getSessionUser } from "@/lib/auth/session"
import { StorefrontShell } from "@/components/layout/storefront-shell"
import { ProductDetail, RelatedProductsSection } from "./product-detail"
import {
  ProductDetailSkeleton,
  ProductGridSkeleton,
} from "@/components/storefront/skeletons"

function getRootCategoryId(product: unknown): string | null {
  const p = product as { category?: unknown }
  if (!p.category) return null
  if (Array.isArray(p.category)) {
    const first = p.category[0] as { id?: string } | undefined
    return first?.id ?? null
  }
  return (p.category as { id?: string }).id ?? null
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [sessionUser, navCategories, product] = await Promise.all([
    getSessionUser(supabase),
    getNavigationCategories(supabase),
    getProduct(supabase, id),
  ])

  if (!product) notFound()

  const catId = getRootCategoryId(product)

  return (
    <StorefrontShell user={sessionUser} categories={navCategories}>
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-7xl px-4 py-5">
            <ProductDetailSkeleton />
          </div>
        }
      >
        <ProductDetail product={product as never} />
      </Suspense>
      {catId && (
        <Suspense
          fallback={
            <div className="mx-auto mt-10 w-full max-w-7xl px-4">
              <ProductGridSkeleton
                count={4}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              />
            </div>
          }
        >
          <RelatedProductsSection categoryId={catId} excludeId={id} />
        </Suspense>
      )}
    </StorefrontShell>
  )
}
