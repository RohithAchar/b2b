import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getBuyerInterestCategoryIds } from "@/lib/buyer/queries"
import { getCachedRecommendedProducts } from "@/lib/storefront-cache"
import { SectionHeader } from "@/components/storefront/section-header"
import {
  ProductCard,
  type ProductCardData,
} from "@/components/storefront/product-card"

const GRID_CLASS = "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"

/**
 * Personalized when the buyer has viewed/saved products; otherwise the newest
 * approved listings. Both paths are real catalogue data.
 */
export async function RecommendedProductsSection() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  const categoryIds = user
    ? await getBuyerInterestCategoryIds(supabase, user.id)
    : []
  const products = await getCachedRecommendedProducts(categoryIds)

  if (products.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader
        title="Recommended products"
        subtitle={
          categoryIds.length > 0
            ? "Based on the categories you have viewed and saved"
            : "Fresh listings from verified suppliers"
        }
        actionLabel="View all"
        actionHref="/products"
      />
      <div className={GRID_CLASS}>
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product as ProductCardData}
            priority={index < 2}
            sizes="(min-width: 1024px) 23vw, (min-width: 640px) 30vw, 46vw"
          />
        ))}
      </div>
    </section>
  )
}
