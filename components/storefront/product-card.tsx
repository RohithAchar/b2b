import Link from "next/link"
import { publicTransformedImageUrl } from "@/lib/storage"
import { Card } from "@/components/ui/card"
import { CardAddButton } from "@/components/storefront/card-add-button"
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
    fit: "contain",
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
    <Card className="group flex h-full flex-col !gap-0 overflow-hidden border-border !py-0 transition-shadow hover:shadow-md">
      <Link href={`/products/${product.id}`} className="block press">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          <ProductImage
            src={coverUrl(product)}
            alt={product.title}
            priority={priority}
            sizes={sizes}
            objectFit="contain"
          />
        </div>

        <div className="flex flex-col gap-1 px-2.5 pt-2">
          <p className="line-clamp-2 min-h-9 text-sm leading-snug font-semibold">
            {product.title}
          </p>

          {product.pricing ? (
            <p className="text-base font-bold tracking-tight text-foreground tabular-nums">
              {formatPrice(product.pricing.customer_price)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / {product.unit}
              </span>
            </p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              Price on request
            </p>
          )}
        </div>
      </Link>

      <div className="mt-auto px-2.5 pt-1.5 pb-2.5">
        <CardAddButton productId={product.id} moq={product.moq} />
      </div>
    </Card>
  )
}
