import Link from "next/link"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { createClient } from "@/lib/supabase/server"
import { getCachedWinningProducts, getCachedHotSellingProducts, getCachedProducts } from "@/lib/storefront-cache"
import { publicTransformedImageUrl } from "@/lib/storage"
import { ProductImage } from "@/components/storefront/product-image"
import { ProductCard, type ProductCardData } from "@/components/storefront/product-card"
import { Button } from "@/components/ui/button"

const PRICE_LIMITS = [9, 29, 49, 99] as const

function Panel({
  products,
  ctaLabel,
  ctaHref,
  imageSrc,
}: {
  products: ProductCardData[]
  ctaLabel: string
  ctaHref: string
  imageSrc: string
}) {
  return (
    <div className="flex w-[85vw] shrink-0 snap-start flex-col rounded-xl bg-brand-50 p-4 lg:w-auto">
      <div className="mb-3 overflow-hidden rounded-lg bg-muted">
        <div className="relative aspect-[3/1] w-full overflow-hidden bg-brand-50">
          <Image
            src={imageSrc}
            alt={ctaLabel}
            fill
            sizes="(min-width: 1024px) 18vw, (min-width: 768px) 22vw, 44vw"
            className="object-cover"
          />
        </div>
      </div>
      {products.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No products available right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 ml-1">
          {products.slice(0, 4).map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={index < 2}
              sizes="(min-width: 1024px) 18vw, (min-width: 768px) 22vw, 44vw"
            />
          ))}
        </div>
      )}
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={ctaHref} />}
        className="mt-3 h-10 w-full border-primary bg-primary text-primary-foreground hover:bg-brand-dark hover:text-primary-foreground"
      >
        {ctaLabel}
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2.2}
          data-icon="inline-end"
        />
      </Button>
    </div>
  )
}

export async function SelectPromotionalCollections() {
  const supabase = await createClient();
  const { data: selectStore } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", "d2h-select")
    .maybeSingle();
  const selectStoreId = (selectStore?.id as string | null) ?? null;

  const [winning, hotSelling, ...pricePages] = await Promise.all([
    getCachedWinningProducts(selectStoreId),
    getCachedHotSellingProducts(selectStoreId),
    ...PRICE_LIMITS.map((limit) =>
      getCachedProducts({ maxPrice: limit, perPage: 1, sort: "newest", storeId: selectStoreId ?? undefined }),
    ),
  ])

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5">
      <div className="flex snap-x gap-4 overflow-x-auto px-4 pb-1 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0">
        <Panel
          products={winning as unknown as ProductCardData[]}
          ctaLabel="See all winning products"
          ctaHref="/select/winning"
          imageSrc="/d2h_select/Winning_Products_troph_Banner.jpg"
        />
        <Panel
          products={hotSelling as unknown as ProductCardData[]}
          ctaLabel="See all hot selling"
          ctaHref="/select/hot-selling"
          imageSrc="/d2h_select/Hot_Selling_Shopping_Cart_Banner.jpg"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRICE_LIMITS.map((limit, index) => {
          const page = pricePages[index]
          const product = (page?.products?.[0] ?? null) as ProductCardData | null
          const cover = product?.images
            ? [...product.images].sort((a, b) => a.sort - b.sort)[0]
            : null
          const imageSrc = cover
            ? publicTransformedImageUrl("product_images", cover.path, {
                width: 240,
                height: 240,
              })
            : null
          return (
            <Link
              key={limit}
              href={`/products?maxPrice=${limit}`}
              className="group press flex flex-col overflow-hidden rounded-xl border border-border bg-card hover:border-brand-300"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                <ProductImage
                  src={imageSrc}
                  alt={product?.title ?? ""}
                  sizes="(min-width: 1024px) 18vw, (min-width: 768px) 22vw, 44vw"
                  priority={index === 0}
                />
              </div>
              <div className="flex flex-col gap-1 px-3 py-2.5">
                <span className="text-[11px] font-medium text-brand-700">
                  Under
                </span>
                <span className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  ₹{limit}
                </span>
                <span className="mt-1 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground group-hover:bg-brand-dark">
                  Shop now
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}