import type { Metadata } from "next"
import { getWinningProducts } from "@/lib/storefront"
import { createClient } from "@/lib/supabase/server"
import { SectionHeader } from "@/components/storefront/section-header"
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card"

export const metadata: Metadata = {
  title: "Winning products — D2H Select",
  alternates: { canonical: "/select/winning" },
}

export default async function WinningProductsPage() {
  const supabase = await createClient()
  const products = await getWinningProducts(supabase, 48)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <SectionHeader title="Winning products" />
      {products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No winning products available right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product as unknown as ProductCardData}
              priority={index < 2}
            />
          ))}
        </div>
      )}
    </div>
  )
}