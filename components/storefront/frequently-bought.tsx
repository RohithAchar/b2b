import { HugeiconsIcon } from "@hugeicons/react"
import { ShoppingCart01Icon } from "@hugeicons/core-free-icons"
import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getBuyAgainProductIds } from "@/lib/buyer/buy-again"
import { getRecentlyViewedCards } from "@/lib/buyer/actions"
import { SectionHeader } from "@/components/storefront/section-header"
import { ProductCarousel } from "@/components/storefront/product-carousel"

/**
 * "Buy again": products this buyer ordered before, newest first (like a
 * grocery app's reorder rail). Guests and accounts with no orders see nothing,
 * so the section never shows invented picks.
 */
export async function FrequentlyBoughtSection() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return null

  const productIds = await getBuyAgainProductIds(supabase, user.id)
  if (productIds.length === 0) return null

  // Same priced-card loader as Recently viewed: approved, visible products only.
  const cards = await getRecentlyViewedCards(productIds)
  if (cards.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader
        title="Buy again"
        subtitle="Products you ordered before"
        icon={
          <HugeiconsIcon
            icon={ShoppingCart01Icon}
            strokeWidth={1.8}
            className="size-4"
          />
        }
        actionLabel="My orders"
        actionHref="/orders"
      />
      <ProductCarousel
        products={cards}
        sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 46vw"
      />
    </section>
  )
}
