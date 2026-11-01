import Link from "next/link"
import { publicTransformedImageUrl } from "@/lib/storage"
import { Card, CardContent } from "@/components/ui/card"
import { ProductImage } from "@/components/storefront/product-image"

export type ProductCardData = {
  id: string
  title: string
  unit: string
  moq: number
  negotiable?: boolean
  images?: { path: string; sort: number }[] | null
  pricing: { customer_price: number } | null
  supplier?: {
    business_name?: string
    city?: string
    state?: string
    logo_path?: string | null
  } | null
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function coverUrl(product: ProductCardData): string | null {
  const images = product.images
  if (!images || images.length === 0) return null
  const sorted = [...images].sort((a, b) => a.sort - b.sort)
  return publicTransformedImageUrl("product_images", sorted[0].path, {
    width: 640,
  })
}

export function ProductCard({
  product,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
}: {
  product: ProductCardData
  priority?: boolean
  sizes?: string
}) {
  return (
    <Card className="group !gap-0 overflow-hidden border-border !py-0 transition-shadow hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block press">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <ProductImage
            src={coverUrl(product)}
            alt={product.title}
            priority={priority}
            sizes={sizes}
          />
        </div>

        <CardContent className="flex flex-col gap-2 px-2.5 py-2.5">
          <p className="line-clamp-2 min-h-10 text-sm leading-snug font-semibold">
            {product.title}
          </p>

          {product.pricing ? (
            <p className="min-w-0 truncate text-sm font-bold tracking-tight text-foreground tabular-nums">
              {formatPrice(product.pricing.customer_price)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / {product.unit}
              </span>
            </p>
          ) : (
            <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">
              Price on request
            </p>
          )}
        </CardContent>
      </Link>
    </Card>
  )
}
