import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Location01Icon, ShieldCheckIcon } from "@hugeicons/core-free-icons"
import { publicTransformedImageUrl } from "@/lib/storage"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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
  const supplier = product.supplier?.business_name
  const location = [product.supplier?.city, product.supplier?.state]
    .filter(Boolean)
    .join(", ")

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

        <CardContent className="flex flex-col gap-1 px-2.5 py-2.5">
          <p className="line-clamp-2 min-h-10 text-sm leading-snug font-semibold">
            {product.title}
          </p>

          {product.pricing ? (
            <p className="text-lg font-bold tracking-tight text-foreground tabular-nums">
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

          <p className="inline-flex w-fit items-center rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
            MOQ {product.moq} {product.unit}
          </p>
        </CardContent>
      </Link>

      <CardFooter className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-2.5 py-2 !pt-2">
        <div className="min-w-0 flex-1">
          {supplier ? (
            <div className="flex items-center gap-1">
              <p className="truncate text-xs font-medium text-foreground/80">
                {supplier}
              </p>
              <span className="inline-flex shrink-0 items-center text-success">
                <HugeiconsIcon
                  icon={ShieldCheckIcon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                <span className="sr-only">Verified supplier</span>
              </span>
            </div>
          ) : null}
          {location ? (
            <p className="mt-0.5 flex items-center gap-0.5 truncate text-[11px] text-muted-foreground">
              <HugeiconsIcon
                icon={Location01Icon}
                strokeWidth={2}
                className="size-3 shrink-0"
              />
              {location}
            </p>
          ) : null}
        </div>
        <div className="shrink-0">
          <CardAddButton productId={product.id} moq={product.moq} />
        </div>
      </CardFooter>
    </Card>
  )
}
