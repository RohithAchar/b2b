import { ProductDetailSkeleton } from "@/components/storefront/skeletons"

export default function ProductLoading() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-7xl px-4 py-5">
      <ProductDetailSkeleton />
    </div>
  )
}
